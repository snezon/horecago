// Приводит поле metro существующих профилей к написанию справочника:
// «м. Маяковская» → «Маяковская», неизвестное — выбрасывает.
// Разовый скрипт, безопасен при повторном запуске.
//
//   npx tsx scripts/normalise-metro.ts           # показать, что изменится
//   npx tsx scripts/normalise-metro.ts --apply
//
import { PrismaClient } from "@prisma/client";
import { formatMetroSelection, parseMetroSelection } from "../lib/domain/metro";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.workerProfile.findMany({
    where: { NOT: { metro: null } },
    select: { userId: true, metro: true },
  });

  let changed = 0;
  for (const p of profiles) {
    const next = formatMetroSelection(parseMetroSelection(p.metro ?? ""));
    if (next === p.metro) continue;
    changed++;
    console.log(`${p.userId}: «${p.metro}» → «${next}»`);
    if (apply) {
      await prisma.workerProfile.update({ where: { userId: p.userId }, data: { metro: next } });
    }
  }

  console.log(apply ? `Обновлено: ${changed}` : `Изменится: ${changed} (запустите с --apply)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
