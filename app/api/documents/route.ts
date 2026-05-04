import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "WORKER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const kind = String(form.get("kind") ?? "OTHER");
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = path.extname(file.name) || "";
  const safeName = `${randomBytes(12).toString("hex")}${ext}`;
  const uploadDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, safeName), buf);

  await prisma.document.create({
    data: {
      workerId: user.id,
      kind,
      filename: file.name,
      url: `/uploads/${safeName}`,
    },
  });

  return NextResponse.redirect(new URL("/profile", req.url), 303);
}
