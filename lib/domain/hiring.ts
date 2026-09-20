import { prisma } from "@/lib/db";

export type HireResult = "HIRED" | "NO_SEATS" | "NOT_FOUND" | "ALREADY";

/**
 * Нанимает по отклику. Место занимается условным обновлением: если счётчик
 * изменился между чтением и записью, обновление не проходит и мы пробуем снова.
 * Без этого два одновременных найма на последнее место брали обоих.
 * Счётчик занятых мест (`hiredCount`) меняют только две функции этого файла:
 * эта (занимает место) и `releaseHire` (возвращает своё же). Статус смены
 * («OPEN»/«CLOSED») приводится к фактическому счётчику в `syncShiftStatus`.
 */
export async function hireApplication(
  applicationId: string,
  expectHrId?: string,
): Promise<HireResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { shift: true },
    });
    if (!application) return "NOT_FOUND";
    if (expectHrId && application.shift.hrId !== expectHrId) return "NOT_FOUND";
    if (application.status === "HIRED") return "ALREADY";
    if (application.status !== "PENDING") return "NOT_FOUND";

    const shift = application.shift;
    if (shift.status === "CLOSED" || shift.hiredCount >= shift.headcount) {
      return "NO_SEATS";
    }

    const nextCount = shift.hiredCount + 1;
    const claimed = await prisma.shift.updateMany({
      where: { id: shift.id, hiredCount: shift.hiredCount, status: "OPEN" },
      data: {
        hiredCount: nextCount,
        status: nextCount >= shift.headcount ? "CLOSED" : "OPEN",
      },
    });

    if (claimed.count === 0) continue; // счётчик увели — перечитываем и пробуем снова

    const marked = await prisma.application.updateMany({
      where: { id: applicationId, status: "PENDING" },
      data: { status: "HIRED" },
    });

    if (marked.count === 0) {
      // Отклик увели параллельно — возвращаем место обратно. Уменьшение на
      // единицу без условия безопасно только потому, что мы только что сами
      // это место заняли (см. claimed выше) и hiredCount правит исключительно
      // hireApplication — откатываем гарантированно своё занятие, а не чужое.
      // Второй писатель счётчика — releaseHire ниже; он тоже уменьшает ровно
      // своё, уже выигранное, место, поэтому допущение сохраняется.
      await prisma.shift.updateMany({
        where: { id: shift.id },
        data: { hiredCount: { decrement: 1 }, status: "OPEN" },
      });
      return "ALREADY";
    }
    return "HIRED";
  }
  return "NO_SEATS";
}

export type SyncStatusResult = "OPEN" | "CLOSED" | "NOT_FOUND";

/**
 * Приводит статус смены в соответствие фактическому числу занятых мест.
 * Работодатель правит `headcount` отдельным действием (`updateShift`), которое
 * читает смену обычным запросом — к моменту записи `hiredCount` мог параллельно
 * измениться наймом. Поэтому статус здесь не берётся из устаревшего снимка, а
 * пишется тем же условным `updateMany`, что и занятие места: если `headcount`
 * или `hiredCount` изменились с момента чтения, обновление не проходит и мы
 * перечитываем заново. Счётчик занятых мест эта функция никогда не трогает.
 */
export async function syncShiftStatus(shiftId: string): Promise<SyncStatusResult> {
  let shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return "NOT_FOUND";

  for (let attempt = 0; attempt < 5; attempt++) {
    const nextStatus = shift.hiredCount >= shift.headcount ? "CLOSED" : "OPEN";
    if (shift.status === nextStatus) return nextStatus;

    const updated = await prisma.shift.updateMany({
      where: { id: shiftId, hiredCount: shift.hiredCount, headcount: shift.headcount },
      data: { status: nextStatus },
    });
    if (updated.count > 0) return nextStatus;

    // headcount или hiredCount увели параллельно — перечитываем и пробуем снова
    shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) return "NOT_FOUND";
  }
  return shift.hiredCount >= shift.headcount ? "CLOSED" : "OPEN";
}

export type ReleaseResult = "RELEASED" | "NOT_HIRED" | "NOT_FOUND";

/**
 * Снимает найм: место возвращается в смену, отклик уходит в отказ.
 *
 * Порядок обратен найму и важен: сначала условным обновлением забираем сам
 * отклик из состояния HIRED — выигравший эту гонку и есть тот, кто вправе
 * вернуть место. Только после этого трогаем счётчик, поэтому одновременные
 * снятия не уменьшат его дважды.
 */
export async function releaseHire(
  applicationId: string,
  expectHrId: string,
): Promise<ReleaseResult> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { shift: true },
  });
  if (!application) return "NOT_FOUND";
  if (application.shift.hrId !== expectHrId) return "NOT_FOUND";
  if (application.status !== "HIRED") return "NOT_HIRED";

  const taken = await prisma.application.updateMany({
    where: { id: applicationId, status: "HIRED" },
    data: { status: "REJECTED" },
  });
  if (taken.count === 0) return "NOT_HIRED";

  await prisma.shift.updateMany({
    where: { id: application.shiftId },
    data: { hiredCount: { decrement: 1 }, status: "OPEN" },
  });
  return "RELEASED";
}
