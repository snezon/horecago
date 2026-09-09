import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, role } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  const raw = String(role ?? "");
  const validRole =
    raw === "HR" ? "CLIENT" :
    raw === "AGENCY" || raw === "CLIENT" || raw === "WORKER" ? raw :
    undefined;
  const { url } = await createMagicLink(email, validRole);
  // In dev (no SMTP): return URL so it shows in UI; in prod hide it.
  return NextResponse.json({ ok: true, url: process.env.SMTP_HOST ? undefined : url });
}
