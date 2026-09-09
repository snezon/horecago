import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { migrateHrProfilesToOrgs } from "@/lib/domain/migrate-hr-to-org";

async function makeHr(email: string, hotelName: string) {
  const user = await prisma.user.create({ data: { email, role: "HR" } });
  await prisma.hRProfile.create({
    data: { userId: user.id, hotelName, address: "Москва, Тверская, 1" },
  });
  return user;
}

describe("migrateHrProfilesToOrgs", () => {
  beforeEach(resetDb);

  it("создаёт организацию-заказчика и делает HR владельцем", async () => {
    const user = await makeHr("hr@example.com", "Отель Заря");

    const result = await migrateHrProfilesToOrgs();

    expect(result.created).toBe(1);
    const org = await prisma.org.findFirst({ where: { name: "Отель Заря" } });
    expect(org?.type).toBe("CLIENT");
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: org!.id } },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("организация заказчика сразу верифицирована", async () => {
    await makeHr("hr2@example.com", "Отель Восток");

    await migrateHrProfilesToOrgs();

    const org = await prisma.org.findFirst({ where: { name: "Отель Восток" } });
    expect(org?.verified).toBe(true);
  });

  it("повторный запуск не создаёт дублей", async () => {
    await makeHr("hr3@example.com", "Отель Север");

    await migrateHrProfilesToOrgs();
    const second = await migrateHrProfilesToOrgs();

    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await prisma.org.count()).toBe(1);
  });

  it("чинит организацию, пострадавшую от сбоя до verified-фикса", async () => {
    await makeHr("hr4@example.com", "Отель Юг");

    await migrateHrProfilesToOrgs();
    const org = await prisma.org.findFirst({ where: { name: "Отель Юг" } });
    await prisma.org.update({ where: { id: org!.id }, data: { verified: false } });

    const result = await migrateHrProfilesToOrgs();

    expect(result.repaired).toBe(1);
    expect(result.created).toBe(0);
    const fixed = await prisma.org.findUnique({ where: { id: org!.id } });
    expect(fixed?.verified).toBe(true);
  });

  it("обычный повторный запуск на корректных данных ничего не чинит", async () => {
    await makeHr("hr5@example.com", "Отель Центр");

    await migrateHrProfilesToOrgs();
    const second = await migrateHrProfilesToOrgs();

    expect(second.repaired).toBe(0);
  });
});
