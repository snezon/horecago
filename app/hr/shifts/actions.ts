"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseLocalDate(value: FormDataEntryValue | null): Date {
  const s = String(value ?? "");
  if (!s) throw new Error("Date required");
  return new Date(s);
}

export async function createShift(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "HR") redirect("/");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const payment = Math.max(0, Number(formData.get("payment") ?? 0));
  const paymentNote = String(formData.get("paymentNote") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim();
  const positionId = Number(formData.get("positionId"));
  const headcount = Math.max(1, Number(formData.get("headcount") ?? 1));
  const shiftStart = parseLocalDate(formData.get("shiftStart"));
  const shiftEnd = parseLocalDate(formData.get("shiftEnd"));

  const v = await prisma.shift.create({
    data: {
      hrId: user.id, positionId, title, description,
      payment, paymentNote, address, headcount,
      shiftStart, shiftEnd,
    },
  });

  redirect(`/hr/shifts/${v.id}`);
}

export async function updateShift(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const v = await prisma.shift.findUnique({ where: { id } });
  if (!v || v.hrId !== user.id) redirect("/hr");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const payment = Math.max(0, Number(formData.get("payment") ?? v.payment));
  const paymentNote = String(formData.get("paymentNote") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim();
  const headcount = Math.max(v.hiredCount, Number(formData.get("headcount") ?? 1));
  const shiftStart = parseLocalDate(formData.get("shiftStart"));
  const shiftEnd = parseLocalDate(formData.get("shiftEnd"));

  await prisma.shift.update({
    where: { id },
    data: {
      title, description, payment, paymentNote, address, headcount,
      shiftStart, shiftEnd,
      status: headcount > v.hiredCount ? "OPEN" : "CLOSED",
    },
  });
  revalidatePath(`/hr/shifts/${id}`);
}

export async function hireApplicant(formData: FormData) {
  const user = await requireUser();
  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { shift: true },
  });
  if (!app || app.shift.hrId !== user.id) return;
  if (app.status !== "PENDING") return;
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
  revalidatePath(`/hr/shifts/${app.shiftId}`);
}

export async function rejectApplicant(formData: FormData) {
  const user = await requireUser();
  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { shift: true },
  });
  if (!app || app.shift.hrId !== user.id) return;
  if (app.status !== "PENDING") return;
  await prisma.application.update({ where: { id: appId }, data: { status: "REJECTED" } });
  revalidatePath(`/hr/shifts/${app.shiftId}`);
}
