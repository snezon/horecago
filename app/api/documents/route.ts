import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasConsent } from "@/lib/domain/consent";
import { canUploadFor } from "@/lib/domain/documents";
import { parseLocalDateInput } from "@/lib/datetime";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "WORKER" && user.role !== "AGENCY")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const workerIdRaw = form.get("workerId");
  const workerId =
    workerIdRaw && String(workerIdRaw).trim() ? String(workerIdRaw).trim() : user.id;

  // Загрузка "за себя" доступна только самому работнику — у агентства нет
  // WorkerProfile, оно всегда указывает workerId явно.
  if (workerId === user.id) {
    if (user.role !== "WORKER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(await canUploadFor(user.id, workerId))) {
    return NextResponse.json(
      { error: "Вы не можете загружать документы за этого работника" },
      { status: 403 }
    );
  }

  if (!(await hasConsent(workerId))) {
    return NextResponse.json(
      { error: "Загрузка документов доступна только после согласия работника на обработку персональных данных" },
      { status: 403 }
    );
  }

  const kind = String(form.get("kind") ?? "OTHER");
  const expiresAtRaw = form.get("expiresAt");
  const expiresAtStr = expiresAtRaw ? String(expiresAtRaw).trim() : "";

  // Проверка обязательности — не только атрибут в разметке: обработчик
  // вызывается напрямую, разметка его не защищает.
  if (kind === "MED_BOOK" && !expiresAtStr) {
    return NextResponse.json(
      { error: "Укажите срок действия медкнижки" },
      { status: 400 }
    );
  }

  let expiresAt: Date | null = null;
  if (expiresAtStr) {
    // Разбираем вручную как локальную полночь, а не через new Date(str) —
    // иначе "ГГГГ-ММ-ДД" уйдёт в UTC-полночь, а shiftStart сравнивается в
    // локальном времени процесса, и сравнение по дню поплывёт при смене
    // часового пояса сервера. См. lib/datetime.ts.
    expiresAt = parseLocalDateInput(expiresAtStr);
    if (!expiresAt) {
      return NextResponse.json({ error: "Некорректная дата окончания срока" }, { status: 400 });
    }
  }

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = path.extname(file.name) || "";
  const safeName = `${randomBytes(12).toString("hex")}${ext}`;
  const uploadDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, safeName), buf);

  await prisma.document.create({
    data: {
      workerId,
      kind,
      filename: file.name,
      url: `/uploads/${safeName}`,
      expiresAt,
      uploadedById: user.id,
    },
  });

  const redirectTo = user.role === "AGENCY" ? "/agency" : "/profile";
  return NextResponse.redirect(new URL(redirectTo, req.url), 303);
}
