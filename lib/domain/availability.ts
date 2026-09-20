import { prisma } from "@/lib/db";

/**
 * Пересекаются ли два интервала. Смена, которая начинается ровно когда
 * заканчивается предыдущая, конфликтом не считается: человек доработал и
 * поехал дальше — так в общепите и бывает.
 */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * Кто уже занят в это время: нанят на смену, пересекающуюся по времени.
 * Нужен и подбору (звать занятого бессмысленно), и авто-найму — иначе
 * автоматика молча назначит человека на две смены сразу, и на одну из них он
 * просто не придёт.
 */
export async function busyWorkerIds(
  start: Date,
  end: Date,
  exceptShiftId?: string,
): Promise<Set<string>> {
  const busy = await prisma.application.findMany({
    where: {
      status: "HIRED",
      shift: {
        ...(exceptShiftId ? { id: { not: exceptShiftId } } : {}),
        shiftStart: { lt: end },
        shiftEnd: { gt: start },
      },
    },
    select: { workerId: true },
  });
  return new Set(busy.map((b) => b.workerId));
}
