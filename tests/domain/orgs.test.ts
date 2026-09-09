import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg, addMember, upsertClientOrgForUser } from "@/lib/domain/orgs";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, role: "WORKER" } });
}

describe("createOrg", () => {
  beforeEach(resetDb);

  it("создаёт организацию и делает создателя владельцем", async () => {
    const user = await makeUser("owner@example.com");

    const org = await createOrg({
      type: "AGENCY",
      name: "Кадры-Сервис",
      inn: "7712345678",
      ownerUserId: user.id,
    });

    expect(org.type).toBe("AGENCY");
    expect(org.name).toBe("Кадры-Сервис");

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("создаёт агентство неверифицированным", async () => {
    const user = await makeUser("agency@example.com");

    const org = await createOrg({
      type: "AGENCY",
      name: "Новое агентство",
      ownerUserId: user.id,
    });

    expect(org.verified).toBe(false);
  });
});

describe("addMember", () => {
  beforeEach(resetDb);

  it("добавляет супервайзера в организацию заказчика", async () => {
    const owner = await makeUser("hr@example.com");
    const supervisor = await makeUser("super@example.com");
    const org = await createOrg({
      type: "CLIENT",
      name: "Отель Заря",
      ownerUserId: owner.id,
    });

    await addMember(org.id, supervisor.id, "SUPERVISOR");

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: supervisor.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("SUPERVISOR");
  });

  it("повторное добавление меняет роль, а не падает", async () => {
    const owner = await makeUser("hr2@example.com");
    const person = await makeUser("person@example.com");
    const org = await createOrg({
      type: "CLIENT",
      name: "Отель Восток",
      ownerUserId: owner.id,
    });

    await addMember(org.id, person.id, "SUPERVISOR");
    await addMember(org.id, person.id, "MANAGER");

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: person.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("MANAGER");
    expect(await prisma.membership.count({ where: { orgId: org.id } })).toBe(2);
  });
});

describe("upsertClientOrgForUser", () => {
  beforeEach(resetDb);

  it("создаёт организацию заказчика, если её ещё не было", async () => {
    const user = await makeUser("newclient@example.com");

    const org = await upsertClientOrgForUser(user.id, "Отель Прибой");

    expect(org.type).toBe("CLIENT");
    expect(org.verified).toBe(true);

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("при повторном вызове с другим названием обновляет имя, а не создаёт вторую организацию", async () => {
    const user = await makeUser("renaming@example.com");

    await upsertClientOrgForUser(user.id, "Отель Прибой");
    const org = await upsertClientOrgForUser(user.id, "Отель Прибой Люкс");

    expect(org.name).toBe("Отель Прибой Люкс");
    expect(await prisma.org.count()).toBe(1);
  });

  it("не трогает организации типа AGENCY", async () => {
    const user = await makeUser("agencyowner@example.com");
    const agency = await createOrg({
      type: "AGENCY",
      name: "Кадры",
      ownerUserId: user.id,
    });

    const clientOrg = await upsertClientOrgForUser(user.id, "Отель Заря");

    const untouchedAgency = await prisma.org.findUnique({ where: { id: agency.id } });
    expect(untouchedAgency?.name).toBe("Кадры");
    expect(clientOrg.type).toBe("CLIENT");
    expect(clientOrg.id).not.toBe(agency.id);
    expect(await prisma.org.count()).toBe(2);
  });
});
