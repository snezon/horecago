import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const POSITIONS = [
  "Горничная",
  "Официант",
  "Бармен",
  "Бариста",
  "Повар (линейный)",
  "Кухонный работник",
  "Хостес",
  "Ресепшн/Администратор",
  "Рунер",
  "Швейцар/Посыльный",
  "Прачечная",
  "Технический персонал",
  "Менеджер смены",
];

async function main() {
  for (const name of POSITIONS) {
    await prisma.position.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${POSITIONS.length} positions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
