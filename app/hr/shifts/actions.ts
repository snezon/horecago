"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hireApplication, releaseHire, syncShiftStatus } from "@/lib/domain/hiring";
import { notifyHired } from "@/lib/domain/hire-notice";
import { computeDecideAt, DEFAULT_AUTO_HIRE_WINDOW_MIN } from "@/lib/domain/auto-hire";
import { formatMetroSelection } from "@/lib/domain/metro-input";
import { resolveStations } from "@/lib/domain/metro";

function parseLocalDate(value: FormDataEntryValue | null): Date {
  const s = String(value ?? "");
  if (!s) throw new Error("Date required");
  return new Date(s);
}


/** Условия смены из формы: город, станции и галочки допуска. */
async function parseRequirements(formData: FormData) {
  const city = String(formData.get("city") ?? "").trim().slice(0, 80);
  const metro = formatMetroSelection(
    await resolveStations(city, String(formData.get("metro") ?? "")),
  );
  const rawWindow = Number(formData.get("autoHireWindowMin"));
  return {
    city,
    metro,
    requireMedBook: Boolean(formData.get("requireMedBook")),
    requireWorkPermit: Boolean(formData.get("requireWorkPermit")),
    autoHire: Boolean(formData.get("autoHire")),
    autoHireWindowMin: Number.isFinite(rawWindow) && rawWindow > 0
      ? rawWindow
      : DEFAULT_AUTO_HIRE_WINDOW_MIN,
  };
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

  const requirements = await parseRequirements(formData);
  const publishedAt = new Date();

  const v = await prisma.shift.create({
    data: {
      hrId: user.id, positionId, title, description,
      payment, paymentNote, address, headcount,
      shiftStart, shiftEnd,
      ...requirements,
      autoHireDecideAt: requirements.autoHire
        ? computeDecideAt(publishedAt, requirements.autoHireWindowMin, shiftStart)
        : null,
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

  const requirements = await parseRequirements(formData);
  // Срок решения пересчитываем от публикации смены, а не от правки: иначе
  // заказчик, поправивший опечатку, каждый раз отодвигал бы авто-найм.
  const autoHireDecideAt = requirements.autoHire
    ? v.autoHireDecideAt ??
      computeDecideAt(v.createdAt, requirements.autoHireWindowMin, shiftStart)
    : null;

  await prisma.shift.update({
    where: { id },
    data: {
      title, description, payment, paymentNote, address, headcount,
      shiftStart, shiftEnd,
      ...requirements,
      autoHireDecideAt,
    },
  });
  // Статус не вычисляем здесь по снимку v, прочитанному выше: между чтением
  // и этой записью параллельно мог пройти найм. syncShiftStatus сам перечитает
  // актуальный счётчик и условно обновит статус.
  await syncShiftStatus(id);
  revalidatePath(`/hr/shifts/${id}`);
}

export async function hireApplicant(formData: FormData) {
  const user = await requireUser();
  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) return;

  const result = await hireApplication(appId, user.id);
  if (result === "NO_SEATS") {
    redirect(`/hr/shifts/${app.shiftId}?error=no_seats`);
  }
  if (result === "HIRED") await notifyHired(appId);
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

export async function releaseApplicant(formData: FormData) {
  const user = await requireUser();
  const appId = String(formData.get("appId"));
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) return;

  await releaseHire(appId, user.id);
  revalidatePath(`/hr/shifts/${app.shiftId}`);
}
