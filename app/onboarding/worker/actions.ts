"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function saveWorkerOnboarding(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "WORKER") redirect("/");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const about = String(formData.get("about") ?? "").trim();
  const skills = formData.getAll("skills").map((v) => Number(v)).filter(Boolean);

  await prisma.user.update({ where: { id: user.id }, data: { name, phone } });
  await prisma.workerProfile.upsert({
    where: { userId: user.id },
    update: { address, about },
    create: { userId: user.id, address, about },
  });
  await prisma.workerSkill.deleteMany({ where: { workerId: user.id } });
  if (skills.length) {
    await prisma.workerSkill.createMany({
      data: skills.map((positionId) => ({ workerId: user.id, positionId })),
    });
  }

  redirect("/feed");
}
