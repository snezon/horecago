import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "./db";
import { sendEmail } from "./email";

const SESSION_COOKIE = "horeca_session";
const SESSION_TTL_DAYS = 30;
const MAGIC_TTL_MIN = 15;

export function generateToken() {
  return randomBytes(32).toString("hex");
}

export async function createMagicLink(email: string, role?: "HR" | "WORKER") {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MIN * 60_000);
  await prisma.magicLink.create({
    data: { email: email.toLowerCase().trim(), token, role, expiresAt },
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

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  await prisma.session.create({ data: { userId, token, expiresAt } });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  cookies().delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: { hrProfile: true, workerProfile: true },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
