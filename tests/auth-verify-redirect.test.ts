import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, resetDb } from "./helpers/db";
import { createMagicLink } from "@/lib/auth-token";
import { sendEmail as sendEmailImpl } from "@/lib/email";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

// Сессию кладём в куки — вне запроса Next их не даёт, подменяем хранилище.
vi.mock("next/headers", () => {
  const store = new Map<string, string>();
  return {
    cookies: () => ({
      get: (name: string) =>
        store.has(name) ? { name, value: store.get(name) } : undefined,
      set: (name: string, value: string) => store.set(name, value),
      delete: (name: string) => store.delete(name),
    }),
  };
});

const { GET } = await import("@/app/auth/verify/route");
const sendEmail = vi.mocked(sendEmailImpl);

const APP_URL = "https://horecago.tech";
const previousAppUrl = process.env.APP_URL;
process.env.APP_URL = APP_URL;
afterAll(() => {
  process.env.APP_URL = previousAppUrl;
});

/** Как запрос выглядит изнутри процесса за Caddy: свой же адрес, не домен. */
async function verify(token: string | null) {
  const url = token
    ? `https://localhost:3100/auth/verify?token=${token}`
    : "https://localhost:3100/auth/verify";
  const res = await GET(new NextRequest(url));
  return res.headers.get("location") ?? "";
}

async function linkFor(
  email: string,
  role?: "WORKER" | "AGENCY" | "CLIENT" | "HR",
) {
  await createMagicLink(email, role);
  const link = await prisma.magicLink.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  return link!.token;
}

describe("переход по ссылке из письма", () => {
  beforeEach(resetDb);

  it("регистрация работника ведёт на боевой домен, а не на localhost", async () => {
    const location = await verify(await linkFor("worker@example.com", "WORKER"));
    expect(location).toBe(`${APP_URL}/onboarding/worker`);
  });

  it("регистрация заказчика ведёт на боевой домен", async () => {
    const location = await verify(await linkFor("client@example.com", "CLIENT"));
    expect(location).toBe(`${APP_URL}/onboarding/hr`);
  });

  it("регистрация агентства ведёт на боевой домен", async () => {
    const location = await verify(await linkFor("agency@example.com", "AGENCY"));
    expect(location).toBe(`${APP_URL}/onboarding/agency`);
  });

  it("вход работника с заполненным профилем — на ленту", async () => {
    const user = await prisma.user.create({
      data: { email: "old-worker@example.com", role: "WORKER" },
    });
    await prisma.workerProfile.create({
      data: { userId: user.id, about: "Официант, 3 года" },
    });

    const location = await verify(await linkFor(user.email, "WORKER"));
    expect(location).toBe(`${APP_URL}/feed`);
  });

  it("вход работника без профиля — на онбординг, тоже на боевом домене", async () => {
    const user = await prisma.user.create({
      data: { email: "half-worker@example.com", role: "WORKER" },
    });

    const location = await verify(await linkFor(user.email, "WORKER"));
    expect(location).toBe(`${APP_URL}/onboarding/worker`);
  });

  it("вход агентства — в кабинет агентства", async () => {
    const user = await prisma.user.create({
      data: { email: "old-agency@example.com", role: "AGENCY" },
    });

    const location = await verify(await linkFor(user.email, "AGENCY"));
    expect(location).toBe(`${APP_URL}/agency`);
  });

  it("просроченная или отсутствующая ссылка — на страницу входа боевого домена", async () => {
    expect(await verify(null)).toBe(`${APP_URL}/login`);
    expect(await verify("нет-такого-токена")).toBe(`${APP_URL}/login?error=expired`);
  });

  it("сама ссылка в письме ведёт на боевой домен", async () => {
    const token = await linkFor("mail@example.com", "WORKER");
    const [, , html] = sendEmail.mock.calls.at(-1)!;
    expect(html).toContain(`${APP_URL}/auth/verify?token=${token}`);
  });
});
