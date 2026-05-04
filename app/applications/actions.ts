"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function acceptInvitation(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") return;

  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { shift: true },
  });
  if (!app || app.workerId !== user.id) return;
  if (app.initiator !== "HR" || app.status !== "PENDING") return;
  if (app.shift.status === "CLOSED") return;

  const newHired = app.shift.hiredCount + 1;
  const closing = newHired >= app.shift.headcount;

  await prisma.$transaction([
    prisma.application.update({ where: { id: appId }, data: { status: "HIRED" } }),
    prisma.shift.update({
      where: { id: app.shiftId },
      data: { hiredCount: newHired, status: closing ? "CLOSED" : "OPEN" },
    }),
  ]);
  revalidatePath("/applications");
}

export async function declineInvitation(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") return;

  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app || app.workerId !== user.id) return;
  if (app.initiator !== "HR" || app.status !== "PENDING") return;

  await prisma.application.update({ where: { id: appId }, data: { status: "REJECTED" } });
  revalidatePath("/applications");
}
