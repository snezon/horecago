import { prisma } from "@/lib/db";
import { createMagicLink, INVITE_TTL_MIN } from "@/lib/auth-token";

// Агентство зовёт человека, тот может решать неделями — но через два месяца
// это уже не то же самое согласие: адрес в HoReCa часто переходит от
// человека к человеку, и молча привязывать случайного нового владельца
// адреса к чужому приглашению — ровно то, что мы обещаем не делать.
export const INVITE_MAX_AGE_DAYS = 60;

/**
 * Агентство приглашает работника. Учётную запись за человека мы не заводим:
 * передача нам его контактов третьей стороной без согласия запрещена (152-ФЗ).
 * Поэтому агентство отправляет приглашение, а профиль создаёт сам работник.
 *
 * Приглашение живёт в базе, а не только внутри ссылки: если письмо потеряется
 * или ссылка (7 дней) истечёт, связь с агентством всё равно подхватится при
 * входе — см. acceptPendingInvites.
 */
export async function inviteWorker(agencyId: string, email: string) {
  const normalized = email.toLowerCase().trim();

  const invite = await prisma.agencyInvite.upsert({
    where: { agencyId_email: { agencyId, email: normalized } },
    update: {},
    create: { agencyId, email: normalized, status: "PENDING" },
  });

  const { url, token, delivery } = await createMagicLink(
    normalized,
    "WORKER",
    agencyId,
    INVITE_TTL_MIN,
  );

  await prisma.agencyInvite.update({
    where: { id: invite.id },
    data: {
      deliveryStatus: delivery.ok ? "SENT" : "FAILED",
      deliveryError: delivery.ok ? null : (delivery.error ?? "неизвестная ошибка"),
    },
  });

  // Если человек уже зарегистрирован — представительство заводим сразу,
  // но в статусе PENDING: подтвердит он сам, перейдя по ссылке или войдя
  // любым другим способом. Анкета работника (WorkerProfile) для этого не
  // нужна — представительство это связь агентства с человеком, а не с анкетой.
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Представительство связывает агентство именно с работником: владельцу
  // агентства или заказчику (роль AGENCY/HR) его завести нельзя, даже если
  // email совпал с приглашённым. Письмо всё равно уходит — это просто вход,
  // а не подтверждение связи.
  let representationId = "";
  if (user && user.role === "WORKER") {
    const rep = await prisma.representation.upsert({
      where: { workerId_agencyId: { workerId: user.id, agencyId } },
      update: {},
      create: { workerId: user.id, agencyId, status: "PENDING" },
    });
    representationId = rep.id;
  }

  return { inviteId: invite.id, representationId, url, token, delivery };
}

/**
 * Принимает все ожидающие приглашения на этот адрес. Вызывается при каждом
 * входе (а не только при переходе по ссылке приглашения), поэтому связь с
 * агентством подхватывается, даже если ссылка истекла и человек зашёл сам.
 */
export async function acceptPendingInvites(userId: string, email: string) {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "WORKER") return 0;

  const invites = await prisma.agencyInvite.findMany({
    where: { email: normalized, status: "PENDING" },
  });

  const cutoff = new Date(Date.now() - INVITE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  let accepted = 0;
  for (const invite of invites) {
    // Приглашение старше 60 дней не принимаем молча: помечаем EXPIRED, чтобы
    // было видно, что произошло, а не оставляем висеть вечным PENDING.
    if (invite.createdAt < cutoff) {
      await prisma.agencyInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      continue;
    }

    await activateRepresentation(userId, invite.agencyId);
    await prisma.agencyInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    accepted += 1;
  }
  return accepted;
}

/**
 * Представительство связывает агентство только с работником. Проверка роли
 * живёт здесь, а не у вызывающих: у этой функции их будет больше в следующей
 * фазе, и полагаться каждый раз на внимательность вызывающего кода нельзя.
 */
export async function activateRepresentation(
  workerUserId: string,
  agencyId: string,
) {
  const user = await prisma.user.findUnique({ where: { id: workerUserId } });
  if (!user || user.role !== "WORKER") return;

  await prisma.representation.upsert({
    where: { workerId_agencyId: { workerId: workerUserId, agencyId } },
    update: { status: "ACTIVE", activatedAt: new Date(), revokedAt: null },
    create: {
      workerId: workerUserId,
      agencyId,
      status: "ACTIVE",
      activatedAt: new Date(),
    },
  });
}

export async function revokeRepresentation(
  workerUserId: string,
  agencyId: string,
) {
  await prisma.representation.updateMany({
    where: { workerId: workerUserId, agencyId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  // Отзыв закрывает и приглашение, иначе связь восстановится при следующем
  // входе: acceptPendingInvites подхватит оставшееся PENDING-приглашение и
  // activateRepresentation перезапишет REVOKED обратно в ACTIVE. Принятые
  // (ACCEPTED) приглашения не трогаем — они уже часть истории.
  const user = await prisma.user.findUnique({
    where: { id: workerUserId },
    select: { email: true },
  });
  if (user) {
    await prisma.agencyInvite.updateMany({
      where: { agencyId, email: user.email, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  }
}

export async function activeAgencyIds(workerUserId: string) {
  const rows = await prisma.representation.findMany({
    where: { workerId: workerUserId, status: "ACTIVE" },
    select: { agencyId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.agencyId);
}

/** Активные представительства пачкой: работник → список агентств. */
export async function representingAgencies(workerUserIds: string[]) {
  const result = new Map<string, { id: string; name: string }[]>();
  if (workerUserIds.length === 0) return result;

  const rows = await prisma.representation.findMany({
    where: { workerId: { in: workerUserIds }, status: "ACTIVE" },
    include: { agency: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const row of rows) {
    const list = result.get(row.workerId) ?? [];
    list.push({ id: row.agency.id, name: row.agency.name });
    result.set(row.workerId, list);
  }
  return result;
}

export async function isRepresented(workerUserId: string) {
  const row = await prisma.representation.findFirst({
    where: { workerId: workerUserId, status: "ACTIVE" },
    select: { id: true },
  });
  return Boolean(row);
}
