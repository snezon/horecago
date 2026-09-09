import { randomBytes } from "crypto";
import type { MagicLink } from "@prisma/client";
import { prisma } from "./db";
import { sendEmail } from "./email";

const LOGIN_TTL_MIN = 60;
// Приглашение агентства живёт неделю: аудитория смотрит почту в перерыв или
// вечером, обычных 60 минут не хватает — иначе агентство теряет человека.
export const INVITE_TTL_MIN = 60 * 24 * 7;

export function generateToken() {
  return randomBytes(32).toString("hex");
}

function ttlLabel(ttlMinutes: number) {
  return ttlMinutes > 60 * 24 ? "7 дней" : "60 минут";
}

// "HR" остаётся в объединении, пока Task 5 не переведёт вызовы на "CLIENT":
// без него сборка сломается между задачами.
export async function createMagicLink(
  email: string,
  role?: "WORKER" | "AGENCY" | "CLIENT" | "HR",
  agencyId?: string,
  ttlMinutes: number = LOGIN_TTL_MIN,
) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  await prisma.magicLink.create({
    data: {
      email: email.toLowerCase().trim(),
      token,
      role,
      agencyId: agencyId ?? null,
      expiresAt,
    },
  });
  const url = `${process.env.APP_URL ?? "http://localhost:3100"}/auth/verify?token=${token}`;
  const html = `
    <p>Здравствуйте,</p>
    <p>Чтобы войти в HoReCaGo, перейдите по ссылке (действует ${ttlLabel(ttlMinutes)}):</p>
    <p><a href="${url}">${url}</a></p>
    <p>Если вы не запрашивали ссылку — просто проигнорируйте письмо.</p>
  `;
  const delivery = await sendEmail(email, "Вход в HoReCaGo", html, `Войти: ${url}`);
  if (!process.env.SMTP_HOST) {
    console.log("\n=== MAGIC LINK ===");
    console.log(`To: ${email}`);
    console.log(`URL: ${url}`);
    console.log("==================\n");
  }
  return { token, url, delivery };
}

type ConsumeResult =
  | { link: MagicLink; reason: null }
  | { link: null; reason: "expired" | "used" | "unknown" };

/**
 * Отличает «ссылки такой нет / истекла» от «уже использована» — на странице
 * входа это два разных сообщения, а не одна общая пустота.
 */
export async function consumeMagicLink(token: string): Promise<ConsumeResult> {
  const link = await prisma.magicLink.findUnique({ where: { token } });
  if (!link) return { link: null, reason: "unknown" };
  if (link.used) return { link: null, reason: "used" };
  if (link.expiresAt < new Date()) return { link: null, reason: "expired" };
  await prisma.magicLink.update({ where: { token }, data: { used: true } });
  return { link, reason: null };
}
