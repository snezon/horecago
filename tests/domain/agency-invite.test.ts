import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import { inviteWorker, acceptPendingInvites } from "@/lib/domain/representation";

async function makeAgency(name: string) {
  const owner = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "AGENCY" },
  });
  return createOrg({ type: "AGENCY", name, ownerUserId: owner.id });
}

describe("inviteWorker", () => {
  beforeEach(resetDb);

  it("создаёт приглашение для незнакомого адреса", async () => {
    const agency = await makeAgency("Кадры");

    await inviteWorker(agency.id, "Nina@Example.COM");

    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.email).toBe("nina@example.com");
    expect(invite?.agencyId).toBe(agency.id);
    expect(invite?.status).toBe("PENDING");
  });

  it("повторное приглашение не плодит дублей", async () => {
    const agency = await makeAgency("Кадры2");

    await inviteWorker(agency.id, "dup@example.com");
    await inviteWorker(agency.id, "dup@example.com");

    expect(await prisma.agencyInvite.count()).toBe(1);
  });
});

describe("acceptPendingInvites", () => {
  beforeEach(resetDb);

  it("активирует представительство при входе, даже если ссылка была другой", async () => {
    const agency = await makeAgency("Кадры3");
    await inviteWorker(agency.id, "late@example.com");

    const user = await prisma.user.create({
      data: { email: "late@example.com", role: "WORKER" },
    });

    const accepted = await acceptPendingInvites(user.id, "late@example.com");

    expect(accepted).toBe(1);
    const rep = await prisma.representation.findUnique({
      where: { workerId_agencyId: { workerId: user.id, agencyId: agency.id } },
    });
    expect(rep?.status).toBe("ACTIVE");
    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("ACCEPTED");
  });

  it("не активирует представительство для не-работника", async () => {
    const agency = await makeAgency("Кадры4");
    await inviteWorker(agency.id, "boss@example.com");
    const user = await prisma.user.create({
      data: { email: "boss@example.com", role: "HR" },
    });

    const accepted = await acceptPendingInvites(user.id, "boss@example.com");

    expect(accepted).toBe(0);
    expect(await prisma.representation.count()).toBe(0);
  });

  it("принятое приглашение повторно не срабатывает", async () => {
    const agency = await makeAgency("Кадры5");
    await inviteWorker(agency.id, "once@example.com");
    const user = await prisma.user.create({
      data: { email: "once@example.com", role: "WORKER" },
    });

    await acceptPendingInvites(user.id, "once@example.com");
    const second = await acceptPendingInvites(user.id, "once@example.com");

    expect(second).toBe(0);
  });

  it("без приглашений возвращает ноль", async () => {
    const user = await prisma.user.create({
      data: { email: "nobody@example.com", role: "WORKER" },
    });
    expect(await acceptPendingInvites(user.id, "nobody@example.com")).toBe(0);
  });
});
