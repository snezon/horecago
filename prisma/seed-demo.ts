/**
 * Demo seed: 3 hotels (HR), 7 workers, 6 vacancies, ~14 applications.
 * All demo users have email ending @demo.horecago.test — used to identify and reset.
 * Idempotent: wipes existing demo data and re-creates.
 */
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const DEMO_DOMAIN = "demo.horecago.test";

const HOTELS = [
  { email: `hr1@${DEMO_DOMAIN}`, name: "Ольга Смирнова",   phone: "+7 495 555-01-11", hotelName: "Гранд Отель Москва", address: "Москва, ул. Тверская, 9" },
  { email: `hr2@${DEMO_DOMAIN}`, name: "Игорь Петров",     phone: "+7 495 555-02-22", hotelName: "Hostel Beehive",     address: "Москва, ул. Земляной вал, 14" },
  { email: `hr3@${DEMO_DOMAIN}`, name: "Мария Лебедева",   phone: "+7 495 555-03-33", hotelName: "Ресторан Aria",      address: "Москва, Малая Бронная, 3" },
];

const WORKERS = [
  { email: `w1@${DEMO_DOMAIN}`, name: "Анна Петрова",      phone: "+7 916 100-01-01", address: "м. Маяковская",   about: "5 лет опыта в гостиницах 4*. Отлично глажу, аккуратная.", positions: ["Горничная", "Ресепшн/Администратор"] },
  { email: `w2@${DEMO_DOMAIN}`, name: "Михаил Иванов",     phone: "+7 916 100-02-02", address: "м. Курская",      about: "Шеф-повар с опытом 8 лет. Европейская и русская кухни.",   positions: ["Повар (линейный)"] },
  { email: `w3@${DEMO_DOMAIN}`, name: "Елена Соколова",    phone: "+7 916 100-03-03", address: "м. Чистые пруды", about: "Бариста, прошла обучение SCA. Английский intermediate.",   positions: ["Бариста", "Бармен"] },
  { email: `w4@${DEMO_DOMAIN}`, name: "Дмитрий Волков",    phone: "+7 916 100-04-04", address: "м. Парк культуры",about: "Официант с опытом 3 года в ресторанах a la carte.",        positions: ["Официант", "Рунер"] },
  { email: `w5@${DEMO_DOMAIN}`, name: "Ольга Кузнецова",   phone: "+7 916 100-05-05", address: "м. Полянка",      about: "Дружелюбная, опыт ресепшн 2 года. Английский B2.",         positions: ["Хостес", "Ресепшн/Администратор"] },
  { email: `w6@${DEMO_DOMAIN}`, name: "Андрей Морозов",    phone: "+7 916 100-06-06", address: "м. Сокол",         about: "Повар горячего цеха, 4 года. Готов на сменный график.",    positions: ["Повар (линейный)", "Кухонный работник"] },
  { email: `w7@${DEMO_DOMAIN}`, name: "Виктория Новикова", phone: "+7 916 100-07-07", address: "м. Таганская",    about: "Молодая, активная. Опыт официанта 1 год + бариста 6 мес.",  positions: ["Официант", "Бариста"] },
];

// Vacancies referenced by 0..N
type V = { hr: number; position: string; title: string; description: string; salary: string; headcount: number };
const VACANCIES: V[] = [
  { hr: 0, position: "Горничная",            title: "Горничная в премиум-отель 4*",        description: "Уборка номеров согласно стандартам сети. Сменный график 2/2, питание + проживание. Соцпакет.", salary: "от 75 000 ₽", headcount: 3 },
  { hr: 0, position: "Ресепшн/Администратор", title: "Администратор ресепшн (английский)", description: "Заселение/выселение гостей, работа в Opera PMS. Английский от B2 обязателен. График 2/2.",       salary: "от 90 000 ₽", headcount: 1 },
  { hr: 1, position: "Горничная",            title: "Горничная в хостел в центре",         description: "Уборка общих зон, подготовка кроватей. График 5/2, дневная смена. Дружный коллектив.",          salary: "55 000 ₽",     headcount: 2 },
  { hr: 2, position: "Повар (линейный)",      title: "Повар горячего цеха",                description: "Заготовки, приготовление по технологическим картам. Опыт от 2 лет обязателен.",                salary: "от 100 000 ₽", headcount: 2 },
  { hr: 2, position: "Официант",             title: "Официант в ресторан авторской кухни",description: "Прием заказов, сервис гостей по стандартам. Чаевые делятся по системе tronc.",                  salary: "70 000 ₽ + чай", headcount: 3 },
  { hr: 2, position: "Бариста",              title: "Бариста на эспрессо-машину",          description: "Утренние и обеденные смены. Знание латте-арта приветствуется.",                                salary: "от 65 000 ₽",  headcount: 1 },
];

// Applications: [vacancyIdx, workerIdx, status]
type AppStatus = "PENDING" | "HIRED" | "REJECTED";
const APPS: [number, number, AppStatus][] = [
  // Гранд Отель — Горничная (3 места) — 1 нанято, 2 в ожидании
  [0, 0, "HIRED"],
  [0, 4, "PENDING"],
  [0, 6, "PENDING"],
  // Гранд Отель — Ресепшн — 2 в ожидании
  [1, 0, "PENDING"],
  [1, 4, "PENDING"],
  // Beehive — Горничная — 1 в ожидании
  [2, 0, "PENDING"],
  // Aria — Повар (2 места) — оба нанято → CLOSED
  [3, 1, "HIRED"],
  [3, 5, "HIRED"],
  // Aria — Официант — 2 в ожидании, 1 отклонён
  [4, 3, "PENDING"],
  [4, 6, "PENDING"],
  [4, 4, "REJECTED"],
  // Aria — Бариста — 2 в ожидании
  [5, 2, "PENDING"],
  [5, 6, "PENDING"],
];

// Minimal valid 1-page PDF "Demo document"
const DEMO_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 47>>stream\nBT /F1 24 Tf 100 700 Td (Demo document) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000054 00000 n \n0000000098 00000 n \n0000000182 00000 n \n0000000277 00000 n \ntrailer<</Size 6/Root 1 0 R>>startxref\n339\n%%EOF",
  "binary",
);

async function main() {
  // 1. Wipe demo data (cascade through users)
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true },
  });
  if (demoUsers.length) {
    await prisma.user.deleteMany({ where: { id: { in: demoUsers.map((u) => u.id) } } });
    console.log(`Wiped ${demoUsers.length} demo users (cascade).`);
  }

  // 2. Ensure positions seeded
  const positions = await prisma.position.findMany();
  const positionByName = new Map(positions.map((p) => [p.name, p.id]));

  // 3. Create HR users + profiles
  const hrIds: string[] = [];
  for (const h of HOTELS) {
    const u = await prisma.user.create({
      data: {
        email: h.email,
        role: "HR",
        name: h.name,
        phone: h.phone,
        hrProfile: { create: { hotelName: h.hotelName, address: h.address } },
      },
    });
    hrIds.push(u.id);
  }
  console.log(`Created ${hrIds.length} HR.`);

  // 4. Create worker users + profiles + skills + 1 placeholder doc each
  const uploadDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  const demoFile = `demo-passport.pdf`;
  await writeFile(path.join(uploadDir, demoFile), DEMO_PDF);

  const workerIds: string[] = [];
  for (const w of WORKERS) {
    const u = await prisma.user.create({
      data: {
        email: w.email,
        role: "WORKER",
        name: w.name,
        phone: w.phone,
        workerProfile: {
          create: {
            address: w.address,
            about: w.about,
            skills: {
              create: w.positions
                .map((name) => positionByName.get(name))
                .filter((id): id is number => Boolean(id))
                .map((positionId) => ({ positionId })),
            },
            documents: {
              create: [
                { kind: "PASSPORT", filename: "passport.pdf", url: `/uploads/${demoFile}` },
                { kind: "MED_BOOK", filename: "med-book.pdf", url: `/uploads/${demoFile}` },
              ],
            },
          },
        },
      },
    });
    workerIds.push(u.id);
  }
  console.log(`Created ${workerIds.length} workers.`);

  // 5. Create vacancies
  const vacancyIds: string[] = [];
  for (const v of VACANCIES) {
    const positionId = positionByName.get(v.position)!;
    const created = await prisma.vacancy.create({
      data: {
        hrId: hrIds[v.hr],
        positionId,
        title: v.title,
        description: v.description,
        salary: v.salary,
        address: HOTELS[v.hr].address,
        headcount: v.headcount,
      },
    });
    vacancyIds.push(created.id);
  }
  console.log(`Created ${vacancyIds.length} vacancies.`);

  // 6. Create applications, then update hiredCount + status accordingly
  const hiredCounts = new Map<string, number>();
  for (const [vi, wi, status] of APPS) {
    await prisma.application.create({
      data: {
        vacancyId: vacancyIds[vi],
        workerId: workerIds[wi],
        status,
      },
    });
    if (status === "HIRED") {
      hiredCounts.set(vacancyIds[vi], (hiredCounts.get(vacancyIds[vi]) ?? 0) + 1);
    }
  }
  for (const [vid, hired] of hiredCounts) {
    const v = await prisma.vacancy.findUnique({ where: { id: vid } });
    if (!v) continue;
    await prisma.vacancy.update({
      where: { id: vid },
      data: {
        hiredCount: hired,
        status: hired >= v.headcount ? "CLOSED" : "OPEN",
      },
    });
  }
  console.log(`Created ${APPS.length} applications.`);

  console.log("\n=== DEMO ACCOUNTS ===");
  console.log("\nHR:");
  for (const h of HOTELS) console.log(`  ${h.email}  →  ${h.hotelName}`);
  console.log("\nWorkers:");
  for (const w of WORKERS) console.log(`  ${w.email}  →  ${w.name}`);
  console.log("\nLogin via https://horecago.tech/demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
