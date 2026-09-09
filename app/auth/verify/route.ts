import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveSignupTarget } from "@/lib/domain/signup";
import { acceptPendingInvites } from "@/lib/domain/representation";

/** Роль ссылки → роль пользователя. "HR" остаётся до переезда экранов в фазе 1. */
function userRoleFor(linkRole: string | null): string {
  if (linkRole === "AGENCY") return "AGENCY";
  if (linkRole === "CLIENT" || linkRole === "HR") return "HR";
  return "WORKER";
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const { link, reason } = await consumeMagicLink(token);
  if (!link) {
    const error = reason === "used" ? "used" : "expired";
    return NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
  }

  let user = await prisma.user.findUnique({
    where: { email: link.email },
    include: { hrProfile: true, workerProfile: true },
  });

  const isNewUser = !user;
  if (!user) {
    user = await prisma.user.create({
      data: { email: link.email, role: userRoleFor(link.role) },
      include: { hrProfile: true, workerProfile: true },
    });
  }

  await createSession(user.id);

  // Приглашение — самостоятельная запись в базе, а не состояние ссылки:
  // принимаем все ожидающие приглашения на этот адрес при любом входе, а не
  // только когда человек перешёл именно по ссылке приглашения.
  await acceptPendingInvites(user.id, user.email);

  const target = resolveSignupTarget(
    { role: link.role, agencyId: link.agencyId },
    isNewUser,
  );
  if (target !== "/") {
    return NextResponse.redirect(new URL(target, req.url));
  }

  // Вернувшийся пользователь: прежняя маршрутизация по незаполненному профилю.
  if (user.role === "HR" && !user.hrProfile) {
    return NextResponse.redirect(new URL("/onboarding/hr", req.url));
  }
  if (user.role === "WORKER" && !user.workerProfile) {
    return NextResponse.redirect(new URL("/onboarding/worker", req.url));
  }
  if (user.role === "AGENCY") {
    return NextResponse.redirect(new URL("/agency", req.url));
  }

  const dest = user.role === "HR" ? "/hr" : "/feed";
  return NextResponse.redirect(new URL(dest, req.url));
}
