import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { overlaps, busyWorkerIds } from "@/lib/domain/availability";

const DAY = new Date(2026, 9, 1);
const at = (h: number) => new Date(2026, 9, 1, h, 0);

describe("overlaps", () => {
  it("накладывающиеся интервалы пересекаются", () => {
    expect(overlaps(at(8), at(16), at(12), at(20))).toBe(true);
    expect(overlaps(at(12), at(20), at(8), at(16))).toBe(true);
  });

  it("смена впритык к предыдущей конфликтом не считается", () => {
    expect(overlaps(at(8), at(16), at(16), at(23))).toBe(false);
  });

  it("разные дни не пересекаются", () => {
    expect(overlaps(at(8), at(16), new Date(2026, 9, 2, 8), new Date(2026, 9, 2, 16))).toBe(false);
  });
});

describe("busyWorkerIds", () => {
  beforeEach(resetDb);

  async function makeShift(startHour: number, endHour: number) {
    const hr = await prisma.user.create({
      data: { email: `hr-${startHour}-${endHour}@example.com`, role: "HR" },
    });
    const position = await prisma.position.create({
      data: { name: `Позиция ${startHour}-${endHour}` },
    });
    return prisma.shift.create({
      data: {
        hrId: hr.id,
        positionId: position.id,
        title: "Смена",
        description: "",
        payment: 3000,
        address: "Москва",
        headcount: 5,
        shiftStart: at(startHour),
        shiftEnd: at(endHour),
      },
    });
  }

  async function hire(shiftId: string, email: string) {
    const worker = await prisma.user.create({ data: { email, role: "WORKER" } });
    await prisma.workerProfile.create({ data: { userId: worker.id } });
    await prisma.application.create({
      data: { shiftId, workerId: worker.id, status: "HIRED" },
    });
    return worker.id;
  }

  it("нанятый на пересекающуюся смену считается занятым", async () => {
    const other = await makeShift(12, 20);
    const workerId = await hire(other.id, "busy@example.com");

    const busy = await busyWorkerIds(at(8), at(16));
    expect(busy.has(workerId)).toBe(true);
  });

  it("нанятый на смену в другое время свободен", async () => {
    const other = await makeShift(18, 23);
    const workerId = await hire(other.id, "free@example.com");

    expect((await busyWorkerIds(at(8), at(16))).has(workerId)).toBe(false);
  });

  it("откликнувшийся, но не нанятый, не занят", async () => {
    const other = await makeShift(12, 20);
    const worker = await prisma.user.create({
      data: { email: "pending@example.com", role: "WORKER" },
    });
    await prisma.workerProfile.create({ data: { userId: worker.id } });
    await prisma.application.create({
      data: { shiftId: other.id, workerId: worker.id, status: "PENDING" },
    });

    expect((await busyWorkerIds(at(8), at(16))).has(worker.id)).toBe(false);
  });

  it("собственная смена не делает человека занятым для самой себя", async () => {
    const own = await makeShift(8, 16);
    const workerId = await hire(own.id, "mine@example.com");

    expect((await busyWorkerIds(at(8), at(16), own.id)).has(workerId)).toBe(false);
    expect((await busyWorkerIds(at(8), at(16))).has(workerId)).toBe(true);
  });
});
