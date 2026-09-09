import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import {
  inviteWorker,
  acceptPendingInvites,
  revokeRepresentation,
} from "@/lib/domain/representation";

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

describe("inviteWorker: повторное приглашение существующей записи", () => {
  beforeEach(resetDb);

  it("возвращает отменённое (CANCELLED) приглашение в PENDING, и после входа работник привязывается", async () => {
    const agency = await makeAgency("Кадры15");
    await prisma.agencyInvite.create({
      data: { agencyId: agency.id, email: "cancelled@example.com", status: "CANCELLED" },
    });

    await inviteWorker(agency.id, "cancelled@example.com");

    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("PENDING");

    const user = await prisma.user.create({
      data: { email: "cancelled@example.com", role: "WORKER" },
    });
    const accepted = await acceptPendingInvites(user.id, "cancelled@example.com");
    expect(accepted).toBe(1);
  });

  it("обновляет дату просроченного (EXPIRED) приглашения, и после входа работник привязывается", async () => {
    const agency = await makeAgency("Кадры16");
    const staleCreatedAt = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);
    await prisma.agencyInvite.create({
      data: {
        agencyId: agency.id,
        email: "expired@example.com",
        status: "EXPIRED",
        createdAt: staleCreatedAt,
      },
    });

    await inviteWorker(agency.id, "expired@example.com");

    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("PENDING");
    expect(invite?.createdAt.getTime()).toBeGreaterThan(staleCreatedAt.getTime());

    const user = await prisma.user.create({
      data: { email: "expired@example.com", role: "WORKER" },
    });
    const accepted = await acceptPendingInvites(user.id, "expired@example.com");
    expect(accepted).toBe(1);
  });

  it("не меняет статус уже принятого (ACCEPTED) приглашения", async () => {
    const agency = await makeAgency("Кадры17");
    const acceptedAt = new Date();
    await prisma.agencyInvite.create({
      data: {
        agencyId: agency.id,
        email: "accepted@example.com",
        status: "ACCEPTED",
        acceptedAt,
      },
    });

    await inviteWorker(agency.id, "accepted@example.com");

    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("ACCEPTED");
    expect(invite?.acceptedAt?.getTime()).toBe(acceptedAt.getTime());
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

  it("приглашение старше 60 дней не принимается и помечается EXPIRED", async () => {
    const agency = await makeAgency("Кадры6");
    const user = await prisma.user.create({
      data: { email: "stale@example.com", role: "WORKER" },
    });
    const createdAt = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);
    await prisma.agencyInvite.create({
      data: {
        agencyId: agency.id,
        email: "stale@example.com",
        status: "PENDING",
        createdAt,
      },
    });

    const accepted = await acceptPendingInvites(user.id, "stale@example.com");

    expect(accepted).toBe(0);
    expect(await prisma.representation.count()).toBe(0);
    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("EXPIRED");
  });

  it("приглашение возрастом 59 дней принимается нормально", async () => {
    const agency = await makeAgency("Кадры7");
    const user = await prisma.user.create({
      data: { email: "fresh@example.com", role: "WORKER" },
    });
    const createdAt = new Date(Date.now() - 59 * 24 * 60 * 60 * 1000);
    await prisma.agencyInvite.create({
      data: {
        agencyId: agency.id,
        email: "fresh@example.com",
        status: "PENDING",
        createdAt,
      },
    });

    const accepted = await acceptPendingInvites(user.id, "fresh@example.com");

    expect(accepted).toBe(1);
    const rep = await prisma.representation.findUnique({
      where: { workerId_agencyId: { workerId: user.id, agencyId: agency.id } },
    });
    expect(rep?.status).toBe("ACTIVE");
  });

  it("приглашение возрастом ровно 60 дней принимается (граница)", async () => {
    // Сравнение в acceptPendingInvites строгое ("<"), т.е. ровно 60 дней —
    // ещё не просрочено. Проверить это без флейка (между setup и вызовом
    // проходит реальное время) можно только зафиксировав часы: иначе
    // createdAt всегда окажется на несколько мс "старше" cutoff.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const agency = await makeAgency("Кадры8");
      const user = await prisma.user.create({
        data: { email: "boundary@example.com", role: "WORKER" },
      });
      const createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      await prisma.agencyInvite.create({
        data: {
          agencyId: agency.id,
          email: "boundary@example.com",
          status: "PENDING",
          createdAt,
        },
      });

      const accepted = await acceptPendingInvites(user.id, "boundary@example.com");

      expect(accepted).toBe(1);
      const rep = await prisma.representation.findUnique({
        where: { workerId_agencyId: { workerId: user.id, agencyId: agency.id } },
      });
      expect(rep?.status).toBe("ACTIVE");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("revokeRepresentation и приглашения", () => {
  beforeEach(resetDb);

  it("отзыв отменяет ещё не принятое (PENDING) приглашение, повторный вход не воскрешает представительство", async () => {
    const agency = await makeAgency("Кадры9");
    const user = await prisma.user.create({
      data: { email: "pending-revoke@example.com", role: "WORKER" },
    });
    // Представительство активируется без приёма приглашения (например, по
    // ссылке приглашения раньше), приглашение при этом остаётся PENDING.
    await prisma.agencyInvite.create({
      data: { agencyId: agency.id, email: "pending-revoke@example.com", status: "PENDING" },
    });
    await prisma.representation.create({
      data: {
        workerId: user.id,
        agencyId: agency.id,
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });

    await revokeRepresentation(user.id, agency.id);

    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("CANCELLED");

    const second = await acceptPendingInvites(user.id, "pending-revoke@example.com");
    expect(second).toBe(0);

    const rep = await prisma.representation.findUnique({
      where: { workerId_agencyId: { workerId: user.id, agencyId: agency.id } },
    });
    expect(rep?.status).toBe("REVOKED");
  });

  it("принятые приглашения при отзыве не трогаются", async () => {
    const agency = await makeAgency("Кадры10");
    const user = await prisma.user.create({
      data: { email: "accepted-revoke@example.com", role: "WORKER" },
    });
    await prisma.agencyInvite.create({
      data: {
        agencyId: agency.id,
        email: "accepted-revoke@example.com",
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });
    await prisma.representation.create({
      data: {
        workerId: user.id,
        agencyId: agency.id,
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });

    await revokeRepresentation(user.id, agency.id);

    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("ACCEPTED");
  });
});
