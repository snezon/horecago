import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "./db";

describe("resetDb", () => {
  beforeEach(resetDb);

  it("удаляет пользователей, оставшихся от прошлого теста", async () => {
    await prisma.user.create({
      data: { email: "leftover@example.com", role: "WORKER" },
    });
    expect(await prisma.user.count()).toBe(1);

    await resetDb();

    expect(await prisma.user.count()).toBe(0);
  });
});
