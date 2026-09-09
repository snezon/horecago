export type SignupRole = "WORKER" | "AGENCY" | "CLIENT";

export function resolveSignupTarget(
  link: { role: string | null; agencyId: string | null },
  isNewUser: boolean,
): string {
  if (!isNewUser) return "/";

  switch (link.role) {
    case "AGENCY":
      return "/onboarding/agency";
    case "CLIENT":
      return "/onboarding/hr";
    case "WORKER":
      return "/onboarding/worker";
    default:
      return "/";
  }
}
