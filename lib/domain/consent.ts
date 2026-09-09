import { prisma } from "@/lib/db";

/** Версия текста согласия. Меняется вместе с текстом на /privacy. */
export const CONSENT_VERSION = "2026-09-09";

export async function recordConsent(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { consentedAt: new Date(), consentVersion: CONSENT_VERSION },
  });
}

export async function hasConsent(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { consentVersion: true },
  });
  return user?.consentVersion === CONSENT_VERSION;
}
