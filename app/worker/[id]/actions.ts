"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function inviteWorker(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "HR") redirect("/");

  const workerId = String(formData.get("workerId"));
  const shiftId = String(formData.get("shiftId"));
  const message = String(formData.get("message") ?? "").trim() || null;

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.hrId !== user.id || shift.status === "CLOSED") {
    redirect(`/worker/${workerId}`);
  }

  // Idempotent: don't duplicate if invitation/application already exists
  const existing = await prisma.application.findUnique({
    where: { shiftId_workerId: { shiftId, workerId } },
  });
  if (!existing) {
    await prisma.application.create({
      data: { shiftId, workerId, initiator: "HR", message, status: "PENDING" },
    });
  }

  revalidatePath(`/worker/${workerId}`);
  redirect(`/worker/${workerId}?invited=1`);
}
