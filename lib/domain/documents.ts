import { prisma } from "@/lib/db";

/**
 * Кто вправе открыть документ работника:
 * — сам работник;
 * — сотрудник агентства, которое его представляет (статус ACTIVE);
 * — заказчик, к смене которого работник имеет отношение (отклик или приглашение).
 * Всем остальным — нет, включая прочих заказчиков площадки.
 */
export async function canViewDocumentUrl(viewerUserId: string, url: string) {
  const doc = await prisma.document.findFirst({ where: { url } });
  if (!doc) return false;

  if (doc.workerId === viewerUserId) return true;

  const agencyLink = await prisma.representation.findFirst({
    where: {
      workerId: doc.workerId,
      status: "ACTIVE",
      agency: { memberships: { some: { userId: viewerUserId } } },
    },
  });
  if (agencyLink) return true;

  const application = await prisma.application.findFirst({
    where: { workerId: doc.workerId, shift: { hrId: viewerUserId } },
  });
  return Boolean(application);
}
