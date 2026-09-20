"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasConsent, needsConsentCheckbox, recordConsent } from "@/lib/domain/consent";
import { resolveMedBook } from "@/lib/domain/med-book";
import { resolveStations } from "@/lib/domain/metro";
import { reindexWorker } from "@/lib/domain/worker-index";
import { formatMetroSelection } from "@/lib/domain/metro-input";

export async function saveWorkerOnboarding(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") redirect("/");

  const consentTicked = Boolean(formData.get("consent"));
  const alreadyConsented = await hasConsent(user.id);
  if (needsConsentCheckbox(alreadyConsented, consentTicked)) {
    redirect("/onboarding/worker?error=consent");
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim().slice(0, 80);
  const metro = formatMetroSelection(
    await resolveStations(city, String(formData.get("metro") ?? "")),
  );
  const about = String(formData.get("about") ?? "").trim();
  const minPaymentRaw = String(formData.get("minPayment") ?? "").trim();
  const minPayment = minPaymentRaw ? Math.max(0, Number(minPaymentRaw)) : null;
  const { hasMedBook, medBookExpiresAt } = resolveMedBook(
    Boolean(formData.get("hasMedBook")),
    String(formData.get("medBookExpiresAt") ?? ""),
  );
  const hasWorkPermit = Boolean(formData.get("hasWorkPermit"));
  const skills = formData.getAll("skills").map((v) => Number(v)).filter(Boolean);

  await prisma.user.update({ where: { id: user.id }, data: { name, phone } });
  await prisma.workerProfile.upsert({
    where: { userId: user.id },
    update: { city, metro, about, minPayment, hasMedBook, medBookExpiresAt, hasWorkPermit },
    create: { userId: user.id, city, metro, about, minPayment, hasMedBook, medBookExpiresAt, hasWorkPermit },
  });
  await reindexWorker(user.id, city, metro);
  await prisma.workerSkill.deleteMany({ where: { workerId: user.id } });
  if (skills.length) {
    await prisma.workerSkill.createMany({
      data: skills.map((positionId) => ({ workerId: user.id, positionId })),
    });
  }

  if (consentTicked) {
    await recordConsent(user.id);
  }

  redirect("/feed");
}
