import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveSignupTarget } from "@/lib/domain/signup";
import { acceptPendingInvites } from "@/lib/domain/representation";
import { appUrl } from "@/lib/app-url";

/** Роль ссылки → роль пользователя. "HR" остаётся до переезда экранов в фазе 1. */
function userRoleFor(linkRole: string | null): string {
  if (linkRole === "AGENCY") return "AGENCY";
  if (linkRole === "CLIENT" || linkRole === "HR") return "HR";
  return "WORKER";
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(appUrl("/login"));

  const { link, reason } = await consumeMagicLink(token);
  if (!link) {
    const error = reason === "used" ? "used" : "expired";
    return NextResponse.redirect(appUrl(`/login?error=${error}`));
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
    return NextResponse.redirect(appUrl(target));
  }

  // Вернувшийся пользователь: прежняя маршрутизация по незаполненному профилю.
  if (user.role === "HR" && !user.hrProfile) {
    return NextResponse.redirect(appUrl("/onboarding/hr"));
  }
  if (user.role === "WORKER" && !user.workerProfile) {
    return NextResponse.redirect(appUrl("/onboarding/worker"));
  }
  if (user.role === "AGENCY") {
    return NextResponse.redirect(appUrl("/agency"));
  }

  const dest = user.role === "HR" ? "/hr" : "/feed";
  return NextResponse.redirect(appUrl(dest));
}
