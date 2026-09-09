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

/**
 * Организация заказчика создаётся при заполнении профиля и переименовывается
 * вместе с ним, чтобы название в реестре не расходилось с анкетой. Заказчиков
 * мы не модерируем (в отличие от агентств, которым верификация закрывает
 * доступ к витрине заявок), поэтому организация сразу верифицирована —
 * так же, как это делает скрипт миграции старых HR-профилей.
 */
export async function upsertClientOrgForUser(userId: string, name: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, org: { type: "CLIENT" } },
  });

  if (!membership) {
    return createOrg({
      type: "CLIENT",
      name,
      ownerUserId: userId,
      verified: true,
    });
  }

  return prisma.org.update({
    where: { id: membership.orgId },
    data: { name },
  });
}
