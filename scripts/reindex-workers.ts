// Пересобирает поисковый слой профилей (cityKey и станции) из их полей.
// Нужен после миграции и безопасен при повторном запуске.
//
//   npx tsx scripts/reindex-workers.ts
//
import { PrismaClient } from "@prisma/client";
import { reindexWorker } from "../lib/domain/worker-index";

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.workerProfile.findMany({
    select: { userId: true, city: true, metro: true },
  });

  for (const p of profiles) {
    await reindexWorker(p.userId, p.city, p.metro);
  }

  const stations = await prisma.workerMetro.count();
  console.log(`Профилей: ${profiles.length}, станций в индексе: ${stations}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
