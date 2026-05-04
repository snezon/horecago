"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function deleteDocument(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.workerId !== user.id) return;
  const uploadDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadDir, path.basename(doc.url));
  await unlink(filePath).catch(() => {});
  await prisma.document.delete({ where: { id } });
  revalidatePath("/profile");
}
