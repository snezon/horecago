"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { agencyIdsOf } from "@/lib/domain/access";
import { inviteWorker } from "@/lib/domain/representation";
import { parseEmailList, MAX_INVITES_PER_BATCH } from "@/lib/domain/emails";

/**
 * Отправка синхронная внутри запроса — сотня писем упрётся в таймаут,
 * поэтому пачка ограничена. Лишние адреса не теряются молча: агентству
 * показывается, сколько не поместилось, чтобы отправить их следующей пачкой.
 */
export async function sendWorkerInvites(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "AGENCY") redirect("/");

  const [agencyId] = await agencyIdsOf(user.id);
  if (!agencyId) return;

  const { emails, invalid } = parseEmailList(String(formData.get("emails") ?? ""));
  const list = emails.slice(0, MAX_INVITES_PER_BATCH);

  let sent = 0;
  let failed = 0;
  for (const email of list) {
    // Один упавший адрес (например, сбой базы, а не почты) не должен
    // обрывать всю пачку — иначе агентство не увидит сводку даже по тем,
    // что уже обработались.
    try {
      const result = await inviteWorker(agencyId, email);
      if (result.delivery.ok) sent++;
      else failed++;
    } catch (e) {
      console.error("Не удалось обработать приглашение:", email, e);
      failed++;
    }
  }

  const skipped = emails.length - list.length;
  revalidatePath("/agency");
  redirect(
    `/agency?sent=${sent}&failed=${failed}&invalid=${invalid.length}&skipped=${skipped}`,
  );
}
