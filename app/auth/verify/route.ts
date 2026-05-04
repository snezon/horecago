import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const link = await consumeMagicLink(token);
  if (!link) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }

  let user = await prisma.user.findUnique({
    where: { email: link.email },
    include: { hrProfile: true, workerProfile: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { email: link.email, role: link.role ?? "WORKER" },
      include: { hrProfile: true, workerProfile: true },
    });
  }

  await createSession(user.id);

  // Route to onboarding if profile not completed
  if (user.role === "HR" && !user.hrProfile) {
    return NextResponse.redirect(new URL("/onboarding/hr", req.url));
  }
  if (user.role === "WORKER" && !user.workerProfile) {
    return NextResponse.redirect(new URL("/onboarding/worker", req.url));
  }

  const dest = user.role === "HR" ? "/hr" : "/feed";
  return NextResponse.redirect(new URL(dest, req.url));
}
