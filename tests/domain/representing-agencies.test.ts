import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import {
  activateRepresentation,
  revokeRepresentation,
  representingAgencies,
  isRepresented,
} from "@/lib/domain/representation";

async function makeWorker(email: string) {
  const user = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: user.id } });
  return user;
}

async function makeAgency(name: string) {
  const owner = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "AGENCY" },
  });
  return createOrg({ type: "AGENCY", name, ownerUserId: owner.id });
}

describe("representingAgencies", () => {
  beforeEach(resetDb);

  it("возвращает агентства по каждому работнику", async () => {
    const w1 = await makeWorker("w1@example.com");
    const w2 = await makeWorker("w2@example.com");
    const agency = await makeAgency("Кадры");
    await activateRepresentation(w1.id, agency.id);

    const map = await representingAgencies([w1.id, w2.id]);

    expect(map.get(w1.id)?.[0]).toEqual({ id: agency.id, name: "Кадры" });
    expect(map.get(w2.id) ?? []).toEqual([]);
  });

  it("не возвращает отозванные представительства", async () => {
    const worker = await makeWorker("w3@example.com");
    const agency = await makeAgency("Отозванное");
    await activateRepresentation(worker.id, agency.id);
    await revokeRepresentation(worker.id, agency.id);

    const map = await representingAgencies([worker.id]);

    expect(map.get(worker.id) ?? []).toEqual([]);
  });

  it("на пустом списке не падает", async () => {
    expect((await representingAgencies([])).size).toBe(0);
  });
});

describe("isRepresented", () => {
  beforeEach(resetDb);

  it("true, если есть активное представительство", async () => {
    const worker = await makeWorker("w4@example.com");
    const agency = await makeAgency("Активное");
    await activateRepresentation(worker.id, agency.id);
    expect(await isRepresented(worker.id)).toBe(true);
  });

  it("false, если представительств нет", async () => {
    const worker = await makeWorker("w5@example.com");
    expect(await isRepresented(worker.id)).toBe(false);
  });
});
