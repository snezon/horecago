import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEMO_DOMAIN = "demo.horecago.test";

export async function POST(req: NextRequest) {
  // Демо-вход пускает без пароля, поэтому в проде он доступен только
  // при явно включённом флаге.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO !== "1") {
    return new Response("Not found", { status: 404 });
  }

  const { email } = await req.json();
  if (typeof email !== "string" || !email.endsWith(`@${DEMO_DOMAIN}`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
