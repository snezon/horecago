"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { agencyIdsOf } from "@/lib/domain/access";
import { inviteWorker } from "@/lib/domain/representation";

export async function sendWorkerInvite(formData: FormData) {
  const user = await requireUser();
  const [agencyId] = await agencyIdsOf(user.id);
  if (!agencyId) return;

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;

  await inviteWorker(agencyId, email);
  revalidatePath("/agency");
}
