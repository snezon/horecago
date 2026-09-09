import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import {
  inviteWorker,
  activateRepresentation,
  revokeRepresentation,
  activeAgencyIds,
} from "@/lib/domain/representation";

async function makeAgency(name: string) {
  const owner = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "WORKER" },
  });
  return createOrg({ type: "AGENCY", name, ownerUserId: owner.id });
}

async function makeWorker(email: string) {
  const user = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: user.id } });
  return user;
}

async function makeUserWithoutProfile(email: string) {
  return prisma.user.create({ data: { email, role: "WORKER" } });
}

describe("inviteWorker", () => {
  beforeEach(resetDb);

  it("создаёт magic-link, привязанный к агентству", async () => {
    const agency = await makeAgency("Кадры");

    const result = await inviteWorker(agency.id, "Nina@Example.COM");

    const link = await prisma.magicLink.findFirst({
      where: { email: "nina@example.com" },
    });
    expect(link?.agencyId).toBe(agency.id);
    expect(link?.role).toBe("WORKER");
    expect(result.url).toContain(link!.token);
  });

  it("не создаёт представительство до активации аккаунта", async () => {
    const agency = await makeAgency("Кадры2");

    await inviteWorker(agency.id, "new@example.com");

    expect(await prisma.representation.count()).toBe(0);
  });

  it("для уже существующего работника создаёт представительство в статусе PENDING", async () => {
    const agency = await makeAgency("Кадры3");
    const worker = await makeWorker("known@example.com");

    await inviteWorker(agency.id, "known@example.com");

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: worker.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("PENDING");
  });

  it("создаёт представительство в статусе PENDING для существующего пользователя без профиля работника", async () => {
    const agency = await makeAgency("Кадры9");
    const user = await makeUserWithoutProfile("noprofile@example.com");

    await inviteWorker(agency.id, "noprofile@example.com");

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: user.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("PENDING");
  });

  it("приглашение по email владельца агентства не создаёт представительство", async () => {
    const agency = await makeAgency("Кадры11");
    await prisma.user.create({ data: { email: "agencyowner@example.com", role: "AGENCY" } });

    await inviteWorker(agency.id, "agencyowner@example.com");

    expect(await prisma.representation.count()).toBe(0);
  });

  it("приглашение по email заказчика (HR) не создаёт представительство", async () => {
    const agency = await makeAgency("Кадры12");
    await prisma.user.create({ data: { email: "hrowner@example.com", role: "HR" } });

    await inviteWorker(agency.id, "hrowner@example.com");

    expect(await prisma.representation.count()).toBe(0);
  });

  it("повторное приглашение не сбрасывает подтверждённое представительство", async () => {
    const agency = await makeAgency("Кадры8");
    const worker = await makeWorker("confirmed@example.com");
    await activateRepresentation(worker.id, agency.id);

    await inviteWorker(agency.id, "confirmed@example.com");

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: worker.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("ACTIVE");
    expect(rep?.activatedAt).toBeInstanceOf(Date);
    expect(await prisma.representation.count()).toBe(1);
  });
});

describe("activateRepresentation", () => {
  beforeEach(resetDb);

  it("переводит представительство в ACTIVE и ставит дату", async () => {
    const agency = await makeAgency("Кадры4");
    const worker = await makeWorker("w1@example.com");

    await activateRepresentation(worker.id, agency.id);

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: worker.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("ACTIVE");
    expect(rep?.activatedAt).toBeInstanceOf(Date);
  });

  it("повторный вызов не создаёт дубль", async () => {
    const agency = await makeAgency("Кадры5");
    const worker = await makeWorker("w2@example.com");

    await activateRepresentation(worker.id, agency.id);
    await activateRepresentation(worker.id, agency.id);

    expect(await prisma.representation.count()).toBe(1);
  });

  it("для пользователя с ролью AGENCY не создаёт представительство", async () => {
    const agency = await makeAgency("Кадры13");
    const user = await prisma.user.create({
      data: { email: "agencyowner2@example.com", role: "AGENCY" },
    });

    await activateRepresentation(user.id, agency.id);

    expect(await prisma.representation.count()).toBe(0);
  });

  it("для пользователя с ролью HR не создаёт представительство", async () => {
    const agency = await makeAgency("Кадры14");
    const user = await prisma.user.create({
      data: { email: "hrowner2@example.com", role: "HR" },
    });

    await activateRepresentation(user.id, agency.id);

    expect(await prisma.representation.count()).toBe(0);
  });

  it("работает для пользователя без WorkerProfile — регрессия на FK-падение при переходе по приглашению", async () => {
    const agency = await makeAgency("Кадры10");
    const user = await makeUserWithoutProfile("noprofile2@example.com");

    await activateRepresentation(user.id, agency.id);

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: user.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("ACTIVE");
    expect(rep?.activatedAt).toBeInstanceOf(Date);
  });
});

describe("revokeRepresentation", () => {
  beforeEach(resetDb);

  it("ставит статус REVOKED и дату отзыва", async () => {
    const agency = await makeAgency("Кадры6");
    const worker = await makeWorker("w3@example.com");
    await activateRepresentation(worker.id, agency.id);

    await revokeRepresentation(worker.id, agency.id);

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: worker.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("REVOKED");
    expect(rep?.revokedAt).toBeInstanceOf(Date);
  });

  it("не удаляет запись — история работника остаётся при нём", async () => {
    const agency = await makeAgency("Кадры7");
    const worker = await makeWorker("w4@example.com");
    await activateRepresentation(worker.id, agency.id);

    await revokeRepresentation(worker.id, agency.id);

    expect(await prisma.representation.count()).toBe(1);
  });
});

describe("activeAgencyIds", () => {
  beforeEach(resetDb);

  it("возвращает только активные представительства", async () => {
    const a1 = await makeAgency("Первое");
    const a2 = await makeAgency("Второе");
    const worker = await makeWorker("w5@example.com");

    await activateRepresentation(worker.id, a1.id);
    await activateRepresentation(worker.id, a2.id);
    await revokeRepresentation(worker.id, a2.id);

    expect(await activeAgencyIds(worker.id)).toEqual([a1.id]);
  });

  it("для работника без агентств возвращает пустой список", async () => {
    const worker = await makeWorker("w6@example.com");

    expect(await activeAgencyIds(worker.id)).toEqual([]);
  });
});
