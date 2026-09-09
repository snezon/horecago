import { prisma } from "@/lib/db";

export type OrgType = "CLIENT" | "AGENCY";
export type MemberRole = "OWNER" | "MANAGER" | "SUPERVISOR";

export async function createOrg(input: {
  type: OrgType;
  name: string;
  legalName?: string;
  inn?: string;
  ownerUserId: string;
  verified?: boolean;
}) {
  const org = await prisma.org.create({
    data: {
      type: input.type,
      name: input.name,
      legalName: input.legalName ?? null,
      inn: input.inn ?? null,
      verified: input.verified ?? false,
    },
  });

  await addMember(org.id, input.ownerUserId, "OWNER");

  return org;
}

export async function addMember(
  orgId: string,
  userId: string,
  role: MemberRole,
) {
  await prisma.membership.upsert({
    where: { userId_orgId: { userId, orgId } },
    update: { role },
    create: { userId, orgId, role },
  });
}
