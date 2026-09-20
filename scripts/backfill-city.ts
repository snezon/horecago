// Проставляет город профилям, у которых он не заполнен, но станции метро
// однозначно принадлежат одному городу из справочника. Профили, где станций
// нет или они из разных городов, не трогает: выдумывать город за человека
// нельзя, а «Москва по умолчанию» — ровно выдумывание.
//
//   npx tsx scripts/backfill-city.ts           # показать, что изменится
//   npx tsx scripts/backfill-city.ts --apply
//
import { PrismaClient } from "@prisma/client";
import { METRO_CITIES } from "@/lib/domain/metro";
import { findStationOffline } from "@/lib/domain/metro";
import { sanitizeMetroInput } from "@/lib/domain/metro-input";
import { reindexWorker } from "@/lib/domain/worker-index";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

/** Город, которому принадлежат ВСЕ станции профиля; иначе null. */
function cityOfStations(metro: string | null): string | null {
  const names = sanitizeMetroInput(metro ?? "");
  if (names.length === 0) return null;

  const cities = METRO_CITIES.filter((city) =>
    names.every((name) => findStationOffline(city, name)),
  );
  return cities.length === 1 ? cities[0] : null;
}

async function main() {
  const profiles = await prisma.workerProfile.findMany({
    select: { userId: true, city: true, metro: true },
  });

  let changed = 0;
  let skipped = 0;
  for (const p of profiles) {
    if (p.city?.trim()) continue;
    const city = cityOfStations(p.metro);
    if (!city) {
      skipped++;
      continue;
    }
    changed++;
    console.log(`${p.userId}: «${p.metro}» → город ${city}`);
    if (apply) {
      await prisma.workerProfile.update({ where: { userId: p.userId }, data: { city } });
      await reindexWorker(p.userId, city, p.metro);
    }
  }

  console.log(
    apply
      ? `Проставлено: ${changed}, пропущено: ${skipped}`
      : `Изменится: ${changed}, пропущено: ${skipped} (запустите с --apply)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
