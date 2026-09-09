"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrg } from "@/lib/domain/orgs";

export async function saveAgencyOnboarding(formData: FormData) {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim() || undefined;
  const inn = String(formData.get("inn") ?? "").trim() || undefined;

  if (!name) redirect("/onboarding/agency?error=name");

  await prisma.user.update({
    where: { id: user.id },
    data: { name: contactName, phone },
  });

  await createOrg({ type: "AGENCY", name, legalName, inn, ownerUserId: user.id });

  redirect("/agency");
}
