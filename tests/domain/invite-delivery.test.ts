import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";

// Мокаем именно отправку письма, а не поведение sendEmail целиком: домену
// важно, что при сбое доставки inviteWorker не роняет запрос, а записывает
// результат в AgencyInvite. Отдельный файл — чтобы мок не задел остальные
// тесты (Vitest не шарит модульный реестр между файлами).
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: false, error: "тестовая ошибка" }),
}));

const { inviteWorker } = await import("@/lib/domain/representation");

async function makeAgency(name: string) {
  const owner = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "AGENCY" },
  });
  return createOrg({ type: "AGENCY", name, ownerUserId: owner.id });
}

describe("inviteWorker: сбой доставки", () => {
  beforeEach(resetDb);

  it("записывает FAILED и текст ошибки в приглашение", async () => {
    const agency = await makeAgency("Кадры-fail");

    const result = await inviteWorker(agency.id, "nodeliver@example.com");

    expect(result.delivery.ok).toBe(false);
    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.deliveryStatus).toBe("FAILED");
    expect(invite?.deliveryError).toContain("тестовая ошибка");
  });
});
