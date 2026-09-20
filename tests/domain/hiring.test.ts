import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { hireApplication, syncShiftStatus, releaseHire } from "@/lib/domain/hiring";

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

describe("syncShiftStatus", () => {
  beforeEach(resetDb);

  it("смена заполнена — приведение статуса закрывает её", async () => {
    const { shift } = await setup(1);
    await prisma.shift.update({ where: { id: shift.id }, data: { hiredCount: 1 } });

    expect(await syncShiftStatus(shift.id)).toBe("CLOSED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.status).toBe("CLOSED");
    expect(fresh?.hiredCount).toBe(1);
  });

  it("работодатель увеличил число мест на заполненной смене — снова открыта", async () => {
    const { shift } = await setup(1);
    await prisma.shift.update({
      where: { id: shift.id },
      data: { hiredCount: 1, status: "CLOSED" },
    });
    await prisma.shift.update({ where: { id: shift.id }, data: { headcount: 2 } });

    expect(await syncShiftStatus(shift.id)).toBe("OPEN");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.status).toBe("OPEN");
    expect(fresh?.hiredCount).toBe(1);
  });

  it("работодатель уменьшил число мест до уже занятого — становится закрытой", async () => {
    const { shift } = await setup(3);
    await prisma.shift.update({ where: { id: shift.id }, data: { hiredCount: 2 } });
    await prisma.shift.update({ where: { id: shift.id }, data: { headcount: 2 } });

    expect(await syncShiftStatus(shift.id)).toBe("CLOSED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.status).toBe("CLOSED");
    expect(fresh?.hiredCount).toBe(2);
  });

  it("не меняет счётчик занятых мест ни в одном из случаев", async () => {
    const { shift } = await setup(2);
    await prisma.shift.update({ where: { id: shift.id }, data: { hiredCount: 2 } });

    await syncShiftStatus(shift.id);
    await syncShiftStatus(shift.id); // повторный вызов — статус уже верный, ветка без записи

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(2);
    expect(fresh?.status).toBe("CLOSED");
  });
});

describe("releaseHire", () => {
  beforeEach(resetDb);

  it("возвращает место в смену и открывает её заново", async () => {
    const { hr, shift } = await setup(1);
    const app = await addApplicant(shift.id, "a@example.com");
    await hireApplication(app.id);

    expect(await releaseHire(app.id, hr.id)).toBe("RELEASED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(0);
    expect(fresh?.status).toBe("OPEN");
    const application = await prisma.application.findUnique({ where: { id: app.id } });
    expect(application?.status).toBe("REJECTED");
  });

  it("чужую смену не трогает", async () => {
    const { shift } = await setup(1);
    const app = await addApplicant(shift.id, "a@example.com");
    await hireApplication(app.id);
    const stranger = await prisma.user.create({
      data: { email: "stranger@example.com", role: "HR" },
    });

    expect(await releaseHire(app.id, stranger.id)).toBe("NOT_FOUND");
    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(1);
  });

  it("повторное снятие места не плодит", async () => {
    const { hr, shift } = await setup(2);
    const app = await addApplicant(shift.id, "a@example.com");
    await hireApplication(app.id);

    expect(await releaseHire(app.id, hr.id)).toBe("RELEASED");
    expect(await releaseHire(app.id, hr.id)).toBe("NOT_HIRED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(0);
  });
});
