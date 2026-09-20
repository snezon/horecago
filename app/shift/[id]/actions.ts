"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { autoHireOnApplication } from "@/lib/domain/auto-hire";

export async function applyToShift(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") redirect("/");

  const shiftId = String(formData.get("shiftId"));
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.status === "CLOSED") return;

  if (!user.workerProfile) redirect("/onboarding/worker");

  const application = await prisma.application.upsert({
    where: { shiftId_workerId: { shiftId, workerId: user.id } },
    update: {},
    create: { shiftId, workerId: user.id },
  });

  // Смена с авто-наймом, у которой окно сбора уже прошло, не ждёт человека:
  // подходящий отклик занимает свободное место сразу.
  await autoHireOnApplication(application.id);

  revalidatePath(`/shift/${shiftId}`);
}
