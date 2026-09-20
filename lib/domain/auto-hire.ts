import { prisma } from "@/lib/db";
import { hireApplication } from "@/lib/domain/hiring";
import { matchShift, type MatchResult } from "@/lib/domain/matching";
import { notifyHired } from "@/lib/domain/hire-notice";
import { busyWorkerIds } from "@/lib/domain/availability";

/**
 * За сколько до начала смены автоматика обязана принять решение. Решать за
 * полчаса бессмысленно: человеку надо успеть доехать, а заказчику — найти
 * замену, если никто не подошёл.
 */
export const DECIDE_BEFORE_SHIFT_MS = 2 * 60 * 60 * 1000;

/** Окна сбора откликов, из которых выбирает заказчик. */
export const AUTO_HIRE_WINDOWS = [60, 180, 720];
export const DEFAULT_AUTO_HIRE_WINDOW_MIN = 180;

/**
 * Когда автоматика решает по смене: публикация плюс окно, но не позже чем за
 * два часа до начала. Если смена начинается совсем скоро, решение принимается
 * сразу — лучше нанять первого подходящего, чем не нанять никого.
 */
export function computeDecideAt(
  publishedAt: Date,
  windowMin: number,
  shiftStart: Date,
): Date {
  const byWindow = publishedAt.getTime() + windowMin * 60_000;
  const latest = shiftStart.getTime() - DECIDE_BEFORE_SHIFT_MS;
  return new Date(Math.max(publishedAt.getTime(), Math.min(byWindow, latest)));
}

export interface Candidate {
  applicationId: string;
  createdAt: Date;
  match: MatchResult;
}

/**
 * Порядок отбора: больше совпавших условий — выше; при равенстве выигрывает
 * тот, кто откликнулся раньше. Это работник может проверить сам, в отличие
 * от любой непрозрачной оценки.
 */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates]
    .filter((c) => c.match.fits)
    .sort((a, b) => {
      const byMatched = b.match.matched.length - a.match.matched.length;
      if (byMatched !== 0) return byMatched;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
}

const SHIFT_WITH_APPLICATIONS = {
  applications: {
    where: { status: "PENDING" },
    include: {
      worker: { include: { workerProfile: true } },
    },
  },
} as const;

type ShiftRow = Awaited<
  ReturnType<
    typeof prisma.shift.findFirst<{ include: typeof SHIFT_WITH_APPLICATIONS }>
  >
>;

function candidatesOf(
  shift: NonNullable<ShiftRow>,
  busy: Set<string>,
): Candidate[] {
  return shift.applications
    .filter((a) => a.worker.workerProfile)
    // Занятого на пересекающейся смене нанимать нельзя: он туда просто не
    // придёт, а заказчик узнает об этом утром в день смены.
    .filter((a) => !busy.has(a.workerId))
    .map((a) => ({
      applicationId: a.id,
      createdAt: a.createdAt,
      match: matchShift(shift, {
        city: a.worker.workerProfile!.city,
        metro: a.worker.workerProfile!.metro,
        hasMedBook: a.worker.workerProfile!.hasMedBook,
        medBookExpiresAt: a.worker.workerProfile!.medBookExpiresAt,
        hasWorkPermit: a.worker.workerProfile!.hasWorkPermit,
        minPayment: a.worker.workerProfile!.minPayment,
      }),
    }));
}

/**
 * Прогон по сменам, у которых подошёл срок решения. Найм делает
 * `hireApplication` — он же занимает место условным обновлением, поэтому
 * параллельный ручной найм автоматике не мешает: лишний кандидат просто
 * получит отказ в месте, а не отберёт чужое.
 */
export async function runAutoHire(now: Date = new Date()): Promise<{
  shifts: number;
  hired: string[];
}> {
  const due = await prisma.shift.findMany({
    where: {
      autoHire: true,
      autoHireDoneAt: null,
      status: "OPEN",
      autoHireDecideAt: { lte: now },
    },
    include: SHIFT_WITH_APPLICATIONS,
    orderBy: { autoHireDecideAt: "asc" },
  });

  const hired: string[] = [];
  for (const shift of due) {
    const seats = shift.headcount - shift.hiredCount;
    const busy = await busyWorkerIds(shift.shiftStart, shift.shiftEnd, shift.id);
    for (const candidate of rankCandidates(candidatesOf(shift, busy)).slice(0, seats)) {
      const result = await hireApplication(candidate.applicationId);
      if (result === "HIRED") {
        hired.push(candidate.applicationId);
        await notifyHired(candidate.applicationId);
      }
      if (result === "NO_SEATS") break;
    }
    // Отметку ставим в любом случае: окно закончилось, дальше смена работает
    // в доборе. Иначе прогон каждые пять минут разбирал бы её заново.
    await prisma.shift.update({
      where: { id: shift.id },
      data: { autoHireDoneAt: now },
    });
  }

  return { shifts: due.length, hired };
}

/**
 * Добор после окна: смена с авто-наймом, у которой решение уже принято, не
 * должна ждать человека — подходящий отклик занимает свободное место сразу.
 * До окна возвращает false: там решают все кандидаты сразу, а не первый.
 */
export async function autoHireOnApplication(
  applicationId: string,
): Promise<boolean> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      shift: true,
      worker: { include: { workerProfile: true } },
    },
  });
  if (!application?.worker.workerProfile) return false;

  const shift = application.shift;
  if (!shift.autoHire || !shift.autoHireDoneAt) return false;
  if (shift.status !== "OPEN" || shift.hiredCount >= shift.headcount) return false;

  const profile = application.worker.workerProfile;
  const match = matchShift(shift, {
    city: profile.city,
    metro: profile.metro,
    hasMedBook: profile.hasMedBook,
    medBookExpiresAt: profile.medBookExpiresAt,
    hasWorkPermit: profile.hasWorkPermit,
    minPayment: profile.minPayment,
  });
  if (!match.fits) return false;

  const busy = await busyWorkerIds(shift.shiftStart, shift.shiftEnd, shift.id);
  if (busy.has(application.workerId)) return false;

  const hired = (await hireApplication(applicationId)) === "HIRED";
  if (hired) await notifyHired(applicationId);
  return hired;
}
