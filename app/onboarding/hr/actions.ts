"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function saveHrOnboarding(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "HR") redirect("/");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const hotelName = String(formData.get("hotelName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  await prisma.user.update({ where: { id: user.id }, data: { name, phone } });
  await prisma.hRProfile.upsert({
    where: { userId: user.id },
    update: { hotelName, address },
    create: { userId: user.id, hotelName, address },
  });

  redirect("/hr");
}
