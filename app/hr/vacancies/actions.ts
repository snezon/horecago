"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function createVacancy(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "HR") redirect("/");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const salary = String(formData.get("salary") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim();
  const positionId = Number(formData.get("positionId"));
  const headcount = Math.max(1, Number(formData.get("headcount") ?? 1));

  const v = await prisma.vacancy.create({
    data: { hrId: user.id, title, description, salary, address, positionId, headcount },
  });

  redirect(`/hr/vacancies/${v.id}`);
}

export async function updateVacancy(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const v = await prisma.vacancy.findUnique({ where: { id } });
  if (!v || v.hrId !== user.id) redirect("/hr");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const salary = String(formData.get("salary") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim();
  const headcount = Math.max(v!.hiredCount, Number(formData.get("headcount") ?? 1));

  await prisma.vacancy.update({
    where: { id },
    data: {
      title, description, salary, address, headcount,
      status: headcount > v!.hiredCount ? "OPEN" : "CLOSED",
    },
  });
  revalidatePath(`/hr/vacancies/${id}`);
}

export async function hireApplicant(formData: FormData) {
  const user = await requireUser();
  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { vacancy: true },
  });
  if (!app || app.vacancy.hrId !== user.id) return;
  if (app.status !== "PENDING") return;
  if (app.vacancy.status === "CLOSED") return;

  const newHired = app.vacancy.hiredCount + 1;
  const closing = newHired >= app.vacancy.headcount;

  await prisma.$transaction([
    prisma.application.update({
      where: { id: appId },
      data: { status: "HIRED" },
    }),
    prisma.vacancy.update({
      where: { id: app.vacancyId },
      data: {
        hiredCount: newHired,
        status: closing ? "CLOSED" : "OPEN",
      },
    }),
  ]);
  revalidatePath(`/hr/vacancies/${app.vacancyId}`);
}

export async function rejectApplicant(formData: FormData) {
  const user = await requireUser();
  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { vacancy: true },
  });
  if (!app || app.vacancy.hrId !== user.id) return;
  if (app.status !== "PENDING") return;
  await prisma.application.update({
    where: { id: appId },
    data: { status: "REJECTED" },
  });
  revalidatePath(`/hr/vacancies/${app.vacancyId}`);
}
