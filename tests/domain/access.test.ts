import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg, addMember } from "@/lib/domain/orgs";
import { agencyIdsOf, clientOrgIdsOf, isAdmin } from "@/lib/domain/access";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, role: "WORKER" } });
}

describe("agencyIdsOf", () => {
  beforeEach(resetDb);

  it("возвращает агентства, где пользователь состоит", async () => {
    const user = await makeUser("a@example.com");
    const agency = await createOrg({
      type: "AGENCY",
      name: "Кадры",
      ownerUserId: user.id,
    });

    expect(await agencyIdsOf(user.id)).toEqual([agency.id]);
  });

  it("не возвращает организации заказчиков", async () => {
    const user = await makeUser("b@example.com");
    await createOrg({ type: "CLIENT", name: "Отель", ownerUserId: user.id });

    expect(await agencyIdsOf(user.id)).toEqual([]);
  });
});

describe("clientOrgIdsOf", () => {
  beforeEach(resetDb);

  it("возвращает организации заказчиков, включая роль супервайзера", async () => {
    const owner = await makeUser("owner@example.com");
    const supervisor = await makeUser("sup@example.com");
    const org = await createOrg({
      type: "CLIENT",
      name: "Отель Заря",
      ownerUserId: owner.id,
    });
    await addMember(org.id, supervisor.id, "SUPERVISOR");

    expect(await clientOrgIdsOf(supervisor.id)).toEqual([org.id]);
  });
});

describe("isAdmin", () => {
  it("узнаёт администратора по списку из переменной окружения", () => {
    process.env.ADMIN_EMAILS = "boss@example.com, second@example.com";

    expect(isAdmin("boss@example.com")).toBe(true);
    expect(isAdmin("BOSS@example.com")).toBe(true);
    expect(isAdmin("second@example.com")).toBe(true);
    expect(isAdmin("stranger@example.com")).toBe(false);
  });

  it("при пустом списке не пускает никого", () => {
    process.env.ADMIN_EMAILS = "";

    expect(isAdmin("boss@example.com")).toBe(false);
  });
});
