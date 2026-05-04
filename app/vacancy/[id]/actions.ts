"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function applyToVacancy(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") redirect("/");

  const vacancyId = String(formData.get("vacancyId"));
  const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
  if (!vacancy || vacancy.status === "CLOSED") return;

  if (!user.workerProfile) redirect("/onboarding/worker");

  await prisma.application.upsert({
    where: { vacancyId_workerId: { vacancyId, workerId: user.id } },
    update: {},
    create: { vacancyId, workerId: user.id },
  });

  revalidatePath(`/vacancy/${vacancyId}`);
}
