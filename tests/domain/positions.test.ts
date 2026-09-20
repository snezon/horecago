import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { mergePosition } from "@/lib/domain/positions";

async function makeWorker(email: string, positionIds: number[]) {
  const user = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: user.id } });
  for (const positionId of positionIds) {
    await prisma.workerSkill.create({ data: { workerId: user.id, positionId } });
  }
  return user.id;
}

async function makeShift(positionId: number) {
  const hr = await prisma.user.create({
    data: { email: `hr-${positionId}-${Math.round(Math.random() * 1e9)}@example.com`, role: "HR" },
  });
  return prisma.shift.create({
    data: {
      hrId: hr.id,
      positionId,
      title: "Смена",
      description: "",
      payment: 3000,
      address: "Москва",
      headcount: 1,
      shiftStart: new Date(2026, 9, 1, 9, 0),
      shiftEnd: new Date(2026, 9, 1, 18, 0),
    },
  });
}

describe("mergePosition", () => {
  let from: number;
  let into: number;

  beforeEach(async () => {
    await resetDb();
    from = (await prisma.position.create({ data: { name: "Рунер" } })).id;
    into = (await prisma.position.create({ data: { name: "Официант" } })).id;
  });

  it("смены переезжают на другую позицию, сама позиция исчезает", async () => {
    const shift = await makeShift(from);

    const result = await mergePosition(from, into);

    expect(result.shifts).toBe(1);
    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.positionId).toBe(into);
    expect(await prisma.position.findUnique({ where: { id: from } })).toBeNull();
  });

  it("навык переносится, если такого у работника ещё нет", async () => {
    const workerId = await makeWorker("solo@example.com", [from]);

    const result = await mergePosition(from, into);

    expect(result.skills).toBe(1);
    const skills = await prisma.workerSkill.findMany({ where: { workerId } });
    expect(skills.map((s) => s.positionId)).toEqual([into]);
  });

  it("у работника с обеими позициями навык не двоится", async () => {
    const workerId = await makeWorker("both@example.com", [from, into]);

    const result = await mergePosition(from, into);

    expect(result.duplicates).toBe(1);
    const skills = await prisma.workerSkill.findMany({ where: { workerId } });
    expect(skills.map((s) => s.positionId)).toEqual([into]);
  });

  it("позицию нельзя слить саму в себя", async () => {
    await expect(mergePosition(from, from)).rejects.toThrow();
  });
});
