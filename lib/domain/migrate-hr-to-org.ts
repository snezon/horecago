import { prisma } from "@/lib/db";
import { createOrg } from "./orgs";

/**
 * Переводит существующие HRProfile в Org(CLIENT) + Membership(OWNER).
 * Идемпотентна: HR, у которого уже есть членство в организации-заказчике, пропускается.
 */
export async function migrateHrProfilesToOrgs() {
  const profiles = await prisma.hRProfile.findMany();
  let created = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const existing = await prisma.membership.findFirst({
      where: { userId: profile.userId, org: { type: "CLIENT" } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const org = await createOrg({
      type: "CLIENT",
      name: profile.hotelName,
      ownerUserId: profile.userId,
    });
    // Заказчиков, заведённых до появления модерации, считаем проверенными.
    await prisma.org.update({
      where: { id: org.id },
      data: { verified: true },
    });
    created++;
  }

  return { created, skipped };
}
