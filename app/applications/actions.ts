"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hireApplication } from "@/lib/domain/hiring";

export async function acceptInvitation(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") return;

  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app || app.workerId !== user.id) return;
  if (app.initiator !== "HR" || app.status !== "PENDING") return;

  await hireApplication(appId);
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
