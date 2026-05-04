"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function applyToShift(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") redirect("/");

  const shiftId = String(formData.get("shiftId"));
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.status === "CLOSED") return;

  if (!user.workerProfile) redirect("/onboarding/worker");

  await prisma.application.upsert({
    where: { shiftId_workerId: { shiftId, workerId: user.id } },
    update: {},
    create: { shiftId, workerId: user.id },
  });

  revalidatePath(`/shift/${shiftId}`);
}
