import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { recordConsent, hasConsent, CONSENT_VERSION } from "@/lib/domain/consent";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, role: "WORKER" } });
}

describe("recordConsent", () => {
  beforeEach(resetDb);

  it("проставляет дату и версию согласия", async () => {
    const user = await makeUser("a@example.com");

    await recordConsent(user.id);

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.consentedAt).toBeInstanceOf(Date);
    expect(fresh?.consentVersion).toBe(CONSENT_VERSION);
  });

  it("повторный вызов обновляет дату", async () => {
    const user = await makeUser("b@example.com");
    await recordConsent(user.id);
    const first = (await prisma.user.findUnique({ where: { id: user.id } }))!.consentedAt!;

    await recordConsent(user.id);
    const second = (await prisma.user.findUnique({ where: { id: user.id } }))!.consentedAt!;

    expect(second.getTime()).toBeGreaterThanOrEqual(first.getTime());
  });
});

describe("hasConsent", () => {
  beforeEach(resetDb);

  it("false до согласия", async () => {
    const user = await makeUser("c@example.com");
    expect(await hasConsent(user.id)).toBe(false);
  });

  it("true после согласия текущей версии", async () => {
    const user = await makeUser("d@example.com");
    await recordConsent(user.id);
    expect(await hasConsent(user.id)).toBe(true);
  });

  it("false, если согласие было на другую версию", async () => {
    const user = await makeUser("e@example.com");
    await prisma.user.update({
      where: { id: user.id },
      data: { consentedAt: new Date(), consentVersion: "устаревшая" },
    });
    expect(await hasConsent(user.id)).toBe(false);
  });
});
