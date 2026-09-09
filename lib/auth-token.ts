import { randomBytes } from "crypto";
import { prisma } from "./db";
import { sendEmail } from "./email";

const MAGIC_TTL_MIN = 15;

export function generateToken() {
  return randomBytes(32).toString("hex");
}

// "HR" остаётся в объединении, пока Task 5 не переведёт вызовы на "CLIENT":
// без него сборка сломается между задачами.
export async function createMagicLink(
  email: string,
  role?: "WORKER" | "AGENCY" | "CLIENT" | "HR",
  agencyId?: string,
) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MIN * 60_000);
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
    <p>Чтобы войти в HoReCaGo, перейдите по ссылке (действует 15 минут):</p>
    <p><a href="${url}">${url}</a></p>
    <p>Если вы не запрашивали ссылку — просто проигнорируйте письмо.</p>
  `;
  await sendEmail(email, "Вход в HoReCaGo", html, `Войти: ${url}`);
  if (!process.env.SMTP_HOST) {
    console.log("\n=== MAGIC LINK ===");
    console.log(`To: ${email}`);
    console.log(`URL: ${url}`);
    console.log("==================\n");
  }
  return { token, url };
}

export async function consumeMagicLink(token: string) {
  const link = await prisma.magicLink.findUnique({ where: { token } });
  if (!link || link.used || link.expiresAt < new Date()) return null;
  await prisma.magicLink.update({ where: { token }, data: { used: true } });
  return link;
}
