import { prisma } from "@/lib/db";
import { createMagicLink } from "@/lib/auth-token";

/**
 * Агентство приглашает работника. Учётную запись за человека мы не заводим:
 * передача нам его контактов третьей стороной без согласия запрещена (152-ФЗ).
 * Поэтому агентство отправляет приглашение, а профиль создаёт сам работник.
 */
export async function inviteWorker(agencyId: string, email: string) {
  const normalized = email.toLowerCase().trim();

  const { url, token } = await createMagicLink(normalized, "WORKER", agencyId);

  // Если человек уже зарегистрирован — представительство заводим сразу,
  // но в статусе PENDING: подтвердит он сам, перейдя по ссылке. Анкета
  // работника (WorkerProfile) для этого не нужна — представительство это
  // связь агентства с человеком, а не с анкетой.
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

  return { representationId, url, token };
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
