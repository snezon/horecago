import { prisma } from "@/lib/db";
import { createOrg } from "./orgs";

/**
 * Переводит существующие HRProfile в Org(CLIENT) + Membership(OWNER).
 * Идемпотентна: HR, у которого уже есть членство в организации-заказчике, пропускается.
 * Если у уже существующей организации по какой-то причине не проставлен verified
 * (например, процесс упал между созданием и подтверждением до этого исправления),
 * skip-путь самоисцеляется: verified доводится до true, а запись считается в repaired.
 */
export async function migrateHrProfilesToOrgs() {
  const profiles = await prisma.hRProfile.findMany();
  let created = 0;
  let skipped = 0;
  let repaired = 0;

  for (const profile of profiles) {
    const existing = await prisma.membership.findFirst({
      where: { userId: profile.userId, org: { type: "CLIENT" } },
      include: { org: true },
    });
    if (existing) {
      skipped++;
      if (!existing.org.verified) {
        await prisma.org.update({
          where: { id: existing.org.id },
          data: { verified: true },
        });
        repaired++;
      }
      continue;
    }

    // Заказчиков, заведённых до появления модерации, считаем проверенными сразу,
    // одним запросом — без окна между созданием и подтверждением.
    await createOrg({
      type: "CLIENT",
      name: profile.hotelName,
      ownerUserId: profile.userId,
      verified: true,
    });
    created++;
  }

  return { created, skipped, repaired };
}
