import { prisma } from "@/lib/db";

async function orgIdsOf(userId: string, type: "CLIENT" | "AGENCY") {
  const rows = await prisma.membership.findMany({
    where: { userId, org: { type } },
    select: { orgId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.orgId);
}

export function agencyIdsOf(userId: string) {
  return orgIdsOf(userId, "AGENCY");
}

export function clientOrgIdsOf(userId: string) {
  return orgIdsOf(userId, "CLIENT");
}

export function isAdmin(email: string) {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
