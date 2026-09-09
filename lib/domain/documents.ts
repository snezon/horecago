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
