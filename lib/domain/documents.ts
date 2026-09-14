import { prisma } from "@/lib/db";

/**
 * Кто вправе видеть документы работника — правило общее для всего, что
 * связано с документами (сам файл, список на карточке работника и т.п.):
 * — сам работник;
 * — сотрудник агентства, которое его представляет (статус ACTIVE);
 * — заказчик, к смене которого работник имеет отношение (отклик или приглашение).
 * Всем остальным — нет, включая прочих заказчиков площадки.
 *
 * Вынесено отдельно от canViewDocumentUrl и canViewWorkerDocuments, чтобы
 * правило не могло разъехаться между ними — обе функции обязаны совпадать
 * по смыслу всегда.
 */
export async function canViewWorkerDocuments(
  viewerUserId: string,
  workerUserId: string,
) {
  if (workerUserId === viewerUserId) return true;

  const agencyLink = await prisma.representation.findFirst({
    where: {
      workerId: workerUserId,
      status: "ACTIVE",
      agency: { memberships: { some: { userId: viewerUserId } } },
    },
  });
  if (agencyLink) return true;

  const application = await prisma.application.findFirst({
    where: { workerId: workerUserId, shift: { hrId: viewerUserId } },
  });
  return Boolean(application);
}

export async function canViewDocumentUrl(viewerUserId: string, url: string) {
  const doc = await prisma.document.findFirst({ where: { url } });
  if (!doc) return false;

  return canViewWorkerDocuments(viewerUserId, doc.workerId);
}

/**
 * Кто вправе загружать документ за работника:
 * — сам работник;
 * — сотрудник агентства, которое его представляет (статус ACTIVE).
 * Заказчики (HR) и посторонние агентства — нет. Согласие работника
 * (hasConsent) сюда не входит — это отдельная проверка, общая для обоих
 * случаев, и делается вызывающим кодом (см. app/api/documents/route.ts).
 */
export async function canUploadFor(actorUserId: string, workerUserId: string) {
  if (actorUserId === workerUserId) return true;

  const agencyLink = await prisma.representation.findFirst({
    where: {
      workerId: workerUserId,
      status: "ACTIVE",
      agency: { memberships: { some: { userId: actorUserId } } },
    },
  });
  return Boolean(agencyLink);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Истёк ли срок документа к дате смены — сравниваем именно с датой смены,
 * а не с сегодняшним днём: человек с медкнижкой до 20 сентября может выйти
 * на смену раньше этой даты, но не позже, и заказчику нужно видеть это
 * заранее, а не утром в день выхода. Сравнение по календарным дням: если
 * срок истекает в день самой смены, документ ещё действует (человек допущен).
 */
export function isExpiredForShift(
  expiresAt: Date | null | undefined,
  shiftStart: Date,
): boolean {
  if (!expiresAt) return false;
  return startOfDay(expiresAt).getTime() < startOfDay(shiftStart).getTime();
}
