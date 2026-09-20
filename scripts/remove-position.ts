// Убирает позицию из справочника, перенося её смены и навыки на другую.
//
//   npx tsx scripts/remove-position.ts "Рунер" "Официант"
//   npx tsx scripts/remove-position.ts "Рунер" "Официант" --apply
//
import { PrismaClient } from "@prisma/client";
import { mergePosition } from "../lib/domain/positions";

const [fromName, intoName] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");

const prisma = new PrismaClient();

async function main() {
  if (!fromName || !intoName) {
    throw new Error('Нужно два имени: "что убираем" "куда переносим"');
  }

  const from = await prisma.position.findUnique({ where: { name: fromName } });
  const into = await prisma.position.findUnique({ where: { name: intoName } });
  if (!from) {
    console.log(`Позиции «${fromName}» нет — убирать нечего`);
    return;
  }
  if (!into) throw new Error(`Позиции «${intoName}» нет в справочнике`);

  const shifts = await prisma.shift.count({ where: { positionId: from.id } });
  const skills = await prisma.workerSkill.count({ where: { positionId: from.id } });
  console.log(`«${fromName}» → «${intoName}»: смен ${shifts}, навыков ${skills}`);

  if (!apply) {
    console.log("Это предпросмотр. Повторите с --apply");
    return;
  }

  const result = await mergePosition(from.id, into.id);
  console.log(
    `Перенесено: смен ${result.shifts}, навыков ${result.skills}` +
      (result.duplicates ? `, навыков-дублей удалено ${result.duplicates}` : ""),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
