import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { canViewDocumentUrl } from "@/lib/domain/documents";

export async function GET(req: NextRequest, { params }: { params: { file: string } }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const filename = path.basename(params.file);
  const allowed = await canViewDocumentUrl(user.id, `/uploads/${filename}`);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const uploadDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadDir, filename);
  try {
    const data = await readFile(filePath);
    return new Response(data, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
