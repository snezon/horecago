import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg, addMember } from "@/lib/domain/orgs";
import { activateRepresentation, revokeRepresentation } from "@/lib/domain/representation";
import { canViewDocumentUrl } from "@/lib/domain/documents";

const URL = "/uploads/abc123.pdf";

async function makeWorkerWithDoc(email = "w@example.com") {
  const user = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: user.id } });
  await prisma.document.create({
    data: { workerId: user.id, kind: "PASSPORT", filename: "p.pdf", url: URL },
  });
  return user;
}

async function makeHr(email: string) {
  return prisma.user.create({ data: { email, role: "HR" } });
}

async function makeShiftWithApplication(hrId: string, workerId: string) {
  const position = await prisma.position.create({ data: { name: `Позиция ${hrId}` } });
  const shift = await prisma.shift.create({
    data: {
      hrId, positionId: position.id, title: "Смена", description: "",
      payment: 3000, address: "Москва", headcount: 1,
      shiftStart: new Date("2026-10-01T08:00:00"),
      shiftEnd: new Date("2026-10-01T20:00:00"),
    },
  });
  await prisma.application.create({ data: { shiftId: shift.id, workerId } });
  return shift;
}

describe("canViewDocumentUrl", () => {
  beforeEach(resetDb);

  it("работник видит свой документ", async () => {
    const worker = await makeWorkerWithDoc();
    expect(await canViewDocumentUrl(worker.id, URL)).toBe(true);
  });

  it("заказчик видит документ кандидата, откликнувшегося на его смену", async () => {
    const worker = await makeWorkerWithDoc();
    const hr = await makeHr("hr@example.com");
    await makeShiftWithApplication(hr.id, worker.id);
    expect(await canViewDocumentUrl(hr.id, URL)).toBe(true);
  });

  it("посторонний заказчик документ не видит", async () => {
    const worker = await makeWorkerWithDoc();
    const hr = await makeHr("hr@example.com");
    await makeShiftWithApplication(hr.id, worker.id);
    const stranger = await makeHr("stranger@example.com");
    expect(await canViewDocumentUrl(stranger.id, URL)).toBe(false);
  });

  it("агентство видит документ своего представленного работника", async () => {
    const worker = await makeWorkerWithDoc();
    const owner = await prisma.user.create({
      data: { email: "owner@example.com", role: "AGENCY" },
    });
    const agency = await createOrg({
      type: "AGENCY", name: "Кадры", ownerUserId: owner.id,
    });
    await activateRepresentation(worker.id, agency.id);
    expect(await canViewDocumentUrl(owner.id, URL)).toBe(true);
  });

  it("чужое агентство документ не видит", async () => {
    const worker = await makeWorkerWithDoc();
    const owner = await prisma.user.create({
      data: { email: "other@example.com", role: "AGENCY" },
    });
    await createOrg({ type: "AGENCY", name: "Другое", ownerUserId: owner.id });
    expect(await canViewDocumentUrl(owner.id, URL)).toBe(false);
  });

  it("другой работник документ не видит", async () => {
    await makeWorkerWithDoc();
    const other = await prisma.user.create({
      data: { email: "other-worker@example.com", role: "WORKER" },
    });
    expect(await canViewDocumentUrl(other.id, URL)).toBe(false);
  });

  it("для несуществующего документа возвращает false", async () => {
    const worker = await makeWorkerWithDoc();
    expect(await canViewDocumentUrl(worker.id, "/uploads/нет.pdf")).toBe(false);
  });

  it("сотрудник агентства, не владелец, документ видит", async () => {
    const worker = await makeWorkerWithDoc();
    const owner = await prisma.user.create({
      data: { email: "owner2@example.com", role: "AGENCY" },
    });
    const manager = await prisma.user.create({
      data: { email: "manager@example.com", role: "AGENCY" },
    });
    const agency = await createOrg({
      type: "AGENCY", name: "Кадры-2", ownerUserId: owner.id,
    });
    await addMember(agency.id, manager.id, "MANAGER");
    await activateRepresentation(worker.id, agency.id);
    expect(await canViewDocumentUrl(manager.id, URL)).toBe(true);
  });

  it("представительство в статусе PENDING доступа не даёт", async () => {
    const worker = await makeWorkerWithDoc();
    const owner = await prisma.user.create({
      data: { email: "owner3@example.com", role: "AGENCY" },
    });
    const agency = await createOrg({
      type: "AGENCY", name: "Кадры-3", ownerUserId: owner.id,
    });
    await prisma.representation.create({
      data: { workerId: worker.id, agencyId: agency.id, status: "PENDING" },
    });
    expect(await canViewDocumentUrl(owner.id, URL)).toBe(false);
  });

  it("отозванное представительство доступа не даёт", async () => {
    const worker = await makeWorkerWithDoc();
    const owner = await prisma.user.create({
      data: { email: "owner4@example.com", role: "AGENCY" },
    });
    const agency = await createOrg({
      type: "AGENCY", name: "Кадры-4", ownerUserId: owner.id,
    });
    await activateRepresentation(worker.id, agency.id);
    await revokeRepresentation(worker.id, agency.id);
    expect(await canViewDocumentUrl(owner.id, URL)).toBe(false);
  });
});
