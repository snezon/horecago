import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import {
  computeDecideAt,
  rankCandidates,
  runAutoHire,
  autoHireOnApplication,
  DECIDE_BEFORE_SHIFT_MS,
} from "@/lib/domain/auto-hire";
import type { MatchResult } from "@/lib/domain/matching";

const SHIFT_START = new Date(2026, 9, 1, 18, 0);

async function makeShift(params: {
  headcount: number;
  autoHire?: boolean;
  decideAt?: Date | null;
  doneAt?: Date | null;
  requireMedBook?: boolean;
  metro?: string | null;
}) {
  const hr = await prisma.user.create({
    data: { email: `hr-${Math.round(SHIFT_START.getTime())}@example.com`, role: "HR" },
  });
  const position = await prisma.position.create({ data: { name: "Клинер" } });
  return prisma.shift.create({
    data: {
      hrId: hr.id,
      positionId: position.id,
      title: "Уборка",
      description: "",
      payment: 4000,
      address: "Москва, Тверская 1",
      headcount: params.headcount,
      shiftStart: SHIFT_START,
      shiftEnd: new Date(2026, 9, 1, 23, 0),
      city: "Москва",
      metro: params.metro === undefined ? "Тверская" : params.metro,
      requireMedBook: params.requireMedBook ?? false,
      autoHire: params.autoHire ?? true,
      autoHireWindowMin: 180,
      autoHireDecideAt: params.decideAt === undefined ? new Date(2026, 9, 1, 10, 0) : params.decideAt,
      autoHireDoneAt: params.doneAt ?? null,
    },
  });
}

async function apply(
  shiftId: string,
  email: string,
  profile: Record<string, unknown>,
  createdAt: Date,
) {
  const worker = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({
    data: { userId: worker.id, city: "Москва", metro: "Тверская", ...profile },
  });
  return prisma.application.create({
    data: { shiftId, workerId: worker.id, createdAt },
  });
}

describe("computeDecideAt", () => {
  const published = new Date(2026, 9, 1, 9, 0);

  it("публикация плюс окно, пока это не поздно", () => {
    expect(computeDecideAt(published, 180, SHIFT_START)).toEqual(
      new Date(2026, 9, 1, 12, 0),
    );
  });

  it("не позже чем за два часа до начала смены", () => {
    const decideAt = computeDecideAt(published, 720, SHIFT_START);
    expect(decideAt.getTime()).toBe(SHIFT_START.getTime() - DECIDE_BEFORE_SHIFT_MS);
  });

  it("смена вот-вот начнётся — решаем сразу, а не в прошлом", () => {
    // Начало в 10:00 — «за два часа до» уже позади момента публикации.
    const soon = new Date(2026, 9, 1, 10, 0);
    expect(computeDecideAt(published, 180, soon)).toEqual(published);
  });
});

describe("rankCandidates", () => {
  const fits = (matched: string[]): MatchResult => ({
    matched: matched as never,
    failed: [],
    fits: true,
  });

  it("больше совпавших условий — выше", () => {
    const ranked = rankCandidates([
      { applicationId: "a", createdAt: new Date(1), match: fits(["payment"]) },
      { applicationId: "b", createdAt: new Date(2), match: fits(["city", "payment"]) },
    ]);
    expect(ranked.map((c) => c.applicationId)).toEqual(["b", "a"]);
  });

  it("при равенстве выигрывает тот, кто откликнулся раньше", () => {
    const ranked = rankCandidates([
      { applicationId: "late", createdAt: new Date(2), match: fits(["payment"]) },
      { applicationId: "early", createdAt: new Date(1), match: fits(["payment"]) },
    ]);
    expect(ranked.map((c) => c.applicationId)).toEqual(["early", "late"]);
  });

  it("неподходящие в отбор не попадают вовсе", () => {
    const ranked = rankCandidates([
      {
        applicationId: "no",
        createdAt: new Date(1),
        match: { matched: [], failed: ["city"] as never, fits: false },
      },
    ]);
    expect(ranked).toEqual([]);
  });
});

describe("runAutoHire", () => {
  beforeEach(resetDb);

  it("из двадцати откликов занимает ровно пять мест", async () => {
    const shift = await makeShift({ headcount: 5 });
    for (let i = 0; i < 20; i++) {
      await apply(shift.id, `w${i}@example.com`, {}, new Date(2026, 9, 1, 9, i));
    }

    const result = await runAutoHire(new Date(2026, 9, 1, 12, 0));

    expect(result.hired).toHaveLength(5);
    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(5);
    expect(fresh?.status).toBe("CLOSED");
  });

  it("берёт тех, у кого совпало больше условий", async () => {
    const shift = await makeShift({ headcount: 1, requireMedBook: true });
    const weak = await apply(
      shift.id,
      "weak@example.com",
      { metro: "Тверская", hasMedBook: true, city: null },
      new Date(2026, 9, 1, 9, 0),
    );
    const strong = await apply(
      shift.id,
      "strong@example.com",
      { metro: "Тверская", hasMedBook: true },
      new Date(2026, 9, 1, 9, 30),
    );

    await runAutoHire(new Date(2026, 9, 1, 12, 0));

    const hired = await prisma.application.findMany({ where: { status: "HIRED" } });
    expect(hired.map((a) => a.id)).toEqual([strong.id]);
    const other = await prisma.application.findUnique({ where: { id: weak.id } });
    // Не прошедших не отклоняем — как и при закрытии смены по набору.
    expect(other?.status).toBe("PENDING");
  });

  it("неподходящих не нанимает, даже если мест хватает", async () => {
    const shift = await makeShift({ headcount: 3, requireMedBook: true });
    await apply(shift.id, "no-med@example.com", { hasMedBook: false }, new Date(2026, 9, 1, 9, 0));
    await apply(
      shift.id,
      "expired@example.com",
      { hasMedBook: true, medBookExpiresAt: new Date(2026, 8, 30) },
      new Date(2026, 9, 1, 9, 5),
    );
    await apply(shift.id, "far@example.com", { metro: "Отрадное", hasMedBook: true }, new Date(2026, 9, 1, 9, 10));

    const result = await runAutoHire(new Date(2026, 9, 1, 12, 0));

    expect(result.hired).toEqual([]);
    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(0);
    expect(fresh?.status).toBe("OPEN");
  });

  it("до срока решения не трогает смену", async () => {
    const shift = await makeShift({ headcount: 1 });
    await apply(shift.id, "w@example.com", {}, new Date(2026, 9, 1, 9, 0));

    const result = await runAutoHire(new Date(2026, 9, 1, 9, 30));

    expect(result.shifts).toBe(0);
    expect(result.hired).toEqual([]);
  });

  it("повторный прогон ничего не меняет", async () => {
    const shift = await makeShift({ headcount: 2 });
    await apply(shift.id, "a@example.com", {}, new Date(2026, 9, 1, 9, 0));
    await apply(shift.id, "b@example.com", {}, new Date(2026, 9, 1, 9, 1));

    await runAutoHire(new Date(2026, 9, 1, 12, 0));
    const second = await runAutoHire(new Date(2026, 9, 1, 12, 5));

    expect(second.shifts).toBe(0);
    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(2);
  });

  it("смену без галочки не трогает", async () => {
    const shift = await makeShift({ headcount: 1, autoHire: false });
    await apply(shift.id, "w@example.com", {}, new Date(2026, 9, 1, 9, 0));

    expect((await runAutoHire(new Date(2026, 9, 1, 12, 0))).shifts).toBe(0);
  });

  it("учитывает уже нанятых руками — лишних мест не выдумывает", async () => {
    const shift = await makeShift({ headcount: 2 });
    await prisma.shift.update({
      where: { id: shift.id },
      data: { hiredCount: 1 },
    });
    await apply(shift.id, "a@example.com", {}, new Date(2026, 9, 1, 9, 0));
    await apply(shift.id, "b@example.com", {}, new Date(2026, 9, 1, 9, 1));

    const result = await runAutoHire(new Date(2026, 9, 1, 12, 0));

    expect(result.hired).toHaveLength(1);
    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(2);
    expect(fresh?.status).toBe("CLOSED");
  });
});

describe("autoHireOnApplication", () => {
  beforeEach(resetDb);

  it("после окна подходящий отклик занимает свободное место сразу", async () => {
    const shift = await makeShift({ headcount: 2, doneAt: new Date(2026, 9, 1, 12, 0) });
    const app = await apply(shift.id, "late@example.com", {}, new Date(2026, 9, 1, 13, 0));

    expect(await autoHireOnApplication(app.id)).toBe(true);
    const fresh = await prisma.application.findUnique({ where: { id: app.id } });
    expect(fresh?.status).toBe("HIRED");
  });

  it("до окна никого не нанимает — решают все кандидаты разом", async () => {
    const shift = await makeShift({ headcount: 2 });
    const app = await apply(shift.id, "early@example.com", {}, new Date(2026, 9, 1, 9, 0));

    expect(await autoHireOnApplication(app.id)).toBe(false);
  });

  it("неподходящего в доборе не берёт", async () => {
    const shift = await makeShift({
      headcount: 2,
      requireMedBook: true,
      doneAt: new Date(2026, 9, 1, 12, 0),
    });
    const app = await apply(shift.id, "no-med@example.com", { hasMedBook: false }, new Date(2026, 9, 1, 13, 0));

    expect(await autoHireOnApplication(app.id)).toBe(false);
  });
});
