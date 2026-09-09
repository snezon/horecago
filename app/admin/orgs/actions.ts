"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/domain/access";

export async function setOrgVerified(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user.email)) return;

  const orgId = String(formData.get("orgId"));
  const verified = String(formData.get("verified")) === "true";

  await prisma.org.update({ where: { id: orgId }, data: { verified } });
  revalidatePath("/admin/orgs");
}
