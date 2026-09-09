import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { hireApplication } from "@/lib/domain/hiring";

async function setup(headcount: number) {
  const hr = await prisma.user.create({ data: { email: "hr@example.com", role: "HR" } });
  const position = await prisma.position.create({ data: { name: "Горничная" } });
  const shift = await prisma.shift.create({
    data: {
      hrId: hr.id, positionId: position.id, title: "Смена", description: "",
      payment: 3000, address: "Москва", headcount,
      shiftStart: new Date("2026-10-01T08:00:00"),
      shiftEnd: new Date("2026-10-01T20:00:00"),
    },
  });
  return { hr, shift };
}

async function addApplicant(shiftId: string, email: string) {
  const worker = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: worker.id } });
  return prisma.application.create({ data: { shiftId, workerId: worker.id } });
}

describe("hireApplication", () => {
  beforeEach(resetDb);

  it("нанимает и увеличивает счётчик", async () => {
    const { shift } = await setup(2);
    const app = await addApplicant(shift.id, "a@example.com");

    expect(await hireApplication(app.id)).toBe("HIRED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(1);
    expect(fresh?.status).toBe("OPEN");
  });

  it("закрывает смену на последнем месте", async () => {
    const { shift } = await setup(1);
    const app = await addApplicant(shift.id, "b@example.com");

    expect(await hireApplication(app.id)).toBe("HIRED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.status).toBe("CLOSED");
  });

  it("не превышает количество мест", async () => {
    const { shift } = await setup(1);
    const first = await addApplicant(shift.id, "c@example.com");
    const second = await addApplicant(shift.id, "d@example.com");

    expect(await hireApplication(first.id)).toBe("HIRED");
    expect(await hireApplication(second.id)).toBe("NO_SEATS");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(1);
    const hired = await prisma.application.count({ where: { status: "HIRED" } });
    expect(hired).toBe(1);
  });

  it("повторный найм того же отклика не меняет счётчик", async () => {
    const { shift } = await setup(3);
    const app = await addApplicant(shift.id, "e@example.com");

    await hireApplication(app.id);
    expect(await hireApplication(app.id)).toBe("ALREADY");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(1);
  });

  it("чужую смену нанять нельзя", async () => {
    const { shift } = await setup(2);
    const app = await addApplicant(shift.id, "f@example.com");
    const stranger = await prisma.user.create({
      data: { email: "stranger@example.com", role: "HR" },
    });

    expect(await hireApplication(app.id, stranger.id)).toBe("NOT_FOUND");
  });

  it("несуществующий отклик", async () => {
    expect(await hireApplication("нет-такого")).toBe("NOT_FOUND");
  });
});
