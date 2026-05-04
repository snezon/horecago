/**
 * Demo seed: 3 hotels (HR), 7 workers, ~10 shifts in next 14 days,
 * ~16 applications. Idempotent: wipes existing demo data and re-creates.
 */
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const DEMO_DOMAIN = "demo.horecago.test";

const HOTELS = [
  { email: `hr1@${DEMO_DOMAIN}`, name: "Ольга Смирнова", phone: "+7 495 555-01-11", hotelName: "Гранд Отель Москва", address: "Москва, ул. Тверская, 9" },
  { email: `hr2@${DEMO_DOMAIN}`, name: "Игорь Петров",   phone: "+7 495 555-02-22", hotelName: "Hostel Beehive",     address: "Москва, ул. Земляной вал, 14" },
  { email: `hr3@${DEMO_DOMAIN}`, name: "Мария Лебедева", phone: "+7 495 555-03-33", hotelName: "Ресторан Aria",      address: "Москва, Малая Бронная, 3" },
];

const WORKERS = [
  { email: `w1@${DEMO_DOMAIN}`, name: "Анна Петрова",      phone: "+7 916 100-01-01", address: "м. Маяковская",   about: "5 лет опыта в гостиницах 4*. Аккуратная, могу выходить в любые смены.", positions: ["Горничная", "Ресепшн/Администратор"], minPayment: 4000, availabilityNote: "Любые смены, кроме среды" },
  { email: `w2@${DEMO_DOMAIN}`, name: "Михаил Иванов",     phone: "+7 916 100-02-02", address: "м. Курская",      about: "Шеф-повар с опытом 8 лет. Холодный/горячий цех. Готов на разовые смены.",   positions: ["Повар (линейный)"],                    minPayment: 5500, availabilityNote: "Будни, вечер" },
  { email: `w3@${DEMO_DOMAIN}`, name: "Елена Соколова",    phone: "+7 916 100-03-03", address: "м. Чистые пруды", about: "Бариста, обучение SCA. Английский B1. Свободна по утрам.",   positions: ["Бариста", "Бармен"],                              minPayment: 3800, availabilityNote: "Утро, будни 7-15" },
  { email: `w4@${DEMO_DOMAIN}`, name: "Дмитрий Волков",    phone: "+7 916 100-04-04", address: "м. Парк культуры",about: "Официант 3 года, рестораны a la carte. Беру вечерние смены.",        positions: ["Официант", "Рунер"],                                minPayment: 3500, availabilityNote: "Вечера, выходные" },
  { email: `w5@${DEMO_DOMAIN}`, name: "Ольга Кузнецова",   phone: "+7 916 100-05-05", address: "м. Полянка",      about: "Опыт ресепшн 2 года, английский B2. Готова на ночные смены.",         positions: ["Хостес", "Ресепшн/Администратор"],                  minPayment: 5000, availabilityNote: "Ночные смены, выходные" },
  { email: `w6@${DEMO_DOMAIN}`, name: "Андрей Морозов",    phone: "+7 916 100-06-06", address: "м. Сокол",         about: "Повар горячего цеха, 4 года. Любые смены.",    positions: ["Повар (линейный)", "Кухонный работник"],                                                  minPayment: 4500, availabilityNote: "Любые смены" },
  { email: `w7@${DEMO_DOMAIN}`, name: "Виктория Новикова", phone: "+7 916 100-07-07", address: "м. Таганская",    about: "Активная, опыт официанта 1 год + бариста 6 мес.",  positions: ["Официант", "Бариста"],                                                            minPayment: 3500, availabilityNote: "Выходные, вечер будни" },
];

// Helper to build a date relative to today at given hour:min
function shiftAt(daysFromToday: number, startHour: number, durationHours: number): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + daysFromToday);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + durationHours);
  return { start, end };
}

type S = {
  hr: number;
  position: string;
  title: string;
  description: string;
  payment: number;       // ₽ за смену
  paymentNote?: string;
  daysFromToday: number;
  startHour: number;
  durationHours: number;
  headcount: number;
};

const SHIFTS: S[] = [
  // Гранд Отель
  { hr: 0, position: "Горничная",            title: "Горничная, утренняя смена",            description: "Уборка номеров согласно стандартам сети. Питание + такси домой после ночной.",        payment: 4500, daysFromToday: 0, startHour: 8,  durationHours: 8, headcount: 3 },
  { hr: 0, position: "Горничная",            title: "Горничная, дневная смена",             description: "Уборка номеров. Бельё, минибар, инвентаризация.",                                     payment: 4500, daysFromToday: 1, startHour: 12, durationHours: 8, headcount: 2 },
  { hr: 0, position: "Ресепшн/Администратор", title: "Ночной ресепшн (английский)",         description: "Заселение/выселение, работа в Opera PMS. Английский B2 обязателен.",                  payment: 6500, paymentNote: "+ чай", daysFromToday: 2, startHour: 22, durationHours: 10, headcount: 1 },

  // Hostel Beehive
  { hr: 1, position: "Горничная",            title: "Уборка хостела, утро",                description: "Общие зоны, кухня, кровати. Дневная смена 5/2 на постоянке тоже доступна.",        payment: 3500, daysFromToday: 1, startHour: 9,  durationHours: 6, headcount: 2 },
  { hr: 1, position: "Хостес",               title: "Дежурный администратор хостела",       description: "Заселение гостей, ответы на вопросы, контроль чистоты. Разговорный английский.",   payment: 4000, daysFromToday: 3, startHour: 14, durationHours: 8, headcount: 1 },

  // Ресторан Aria
  { hr: 2, position: "Повар (линейный)",      title: "Повар горячего цеха, ужин",           description: "Заготовки днём, отдача вечером. Опыт от 2 лет. Питание включено.",                  payment: 5500, daysFromToday: 0, startHour: 14, durationHours: 10, headcount: 2 },
  { hr: 2, position: "Повар (линейный)",      title: "Помощник повара, бранч",              description: "Заготовки, чистка овощей, помощь горячему цеху. Без опыта тоже рассмотрим.",        payment: 3800, daysFromToday: 2, startHour: 9,  durationHours: 8, headcount: 1 },
  { hr: 2, position: "Официант",             title: "Официант, ужин (a la carte)",          description: "Сервис гостей по стандартам. Чаевые делятся через tronc.",                          payment: 3500, paymentNote: "+ чай (~2-4т)", daysFromToday: 1, startHour: 17, durationHours: 7, headcount: 3 },
  { hr: 2, position: "Официант",             title: "Официант, бранч-смена",                description: "Воскресный бранч, активный поток. Английский на уровне меню.",                       payment: 4200, paymentNote: "+ чай", daysFromToday: 4, startHour: 11, durationHours: 6, headcount: 2 },
  { hr: 2, position: "Бариста",              title: "Бариста, утренняя смена",              description: "Эспрессо-бар, латте-арт приветствуется.",                                            payment: 4000, daysFromToday: 2, startHour: 7,  durationHours: 7, headcount: 1 },
];

// Applications: [shiftIdx, workerIdx, status, initiator?, message?]
type AppStatus = "PENDING" | "HIRED" | "REJECTED";
type Initiator = "WORKER" | "HR";
const APPS: [number, number, AppStatus, Initiator?, string?][] = [
  // Заявки от соискателей (initiator=WORKER)
  [0, 0, "HIRED"],
  [0, 4, "PENDING"],
  [0, 6, "PENDING"],
  [1, 0, "PENDING"],
  [2, 4, "PENDING"],
  [2, 0, "PENDING"],
  [3, 0, "PENDING"],
  [4, 4, "PENDING"],
  [5, 1, "HIRED"],
  [5, 5, "HIRED"],
  [6, 5, "PENDING"],
  [7, 3, "PENDING"],
  [7, 6, "PENDING"],
  [7, 4, "REJECTED"],
  [8, 3, "PENDING"],
  [9, 2, "PENDING"],

  // Приглашения от HR (initiator=HR) — HR сам инициирует через ленту соискателей
  [9, 6, "PENDING", "HR", "Виктория, мы видели ваш опыт бариста — приглашаем на нашу утреннюю смену."],
  [4, 0, "PENDING", "HR", "Анна, английский ваш B2 нам подходит. Возьмёте смену?"],
  [3, 6, "HIRED",   "HR", "Виктория, можете завтра подменить?"],
];

const DEMO_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 47>>stream\nBT /F1 24 Tf 100 700 Td (Demo document) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000054 00000 n \n0000000098 00000 n \n0000000182 00000 n \n0000000277 00000 n \ntrailer<</Size 6/Root 1 0 R>>startxref\n339\n%%EOF",
  "binary",
);

async function main() {
  // 1. Wipe demo
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true },
  });
  if (demoUsers.length) {
    await prisma.user.deleteMany({ where: { id: { in: demoUsers.map((u) => u.id) } } });
    console.log(`Wiped ${demoUsers.length} demo users.`);
  }

  // 2. Positions map
  const positions = await prisma.position.findMany();
  const positionByName = new Map(positions.map((p) => [p.name, p.id]));

  // 3. HR
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

  // 4. Workers + docs
  const uploadDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  const demoFile = "demo-passport.pdf";
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
            minPayment: w.minPayment,
            availabilityNote: w.availabilityNote,
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

  // 5. Shifts
  const shiftIds: string[] = [];
  for (const s of SHIFTS) {
    const positionId = positionByName.get(s.position)!;
    const { start, end } = shiftAt(s.daysFromToday, s.startHour, s.durationHours);
    const created = await prisma.shift.create({
      data: {
        hrId: hrIds[s.hr],
        positionId,
        title: s.title,
        description: s.description,
        payment: s.payment,
        paymentNote: s.paymentNote,
        shiftStart: start,
        shiftEnd: end,
        address: HOTELS[s.hr].address,
        headcount: s.headcount,
      },
    });
    shiftIds.push(created.id);
  }

  // 6. Applications + close shifts at headcount
  const hiredCounts = new Map<string, number>();
  const seen = new Set<string>(); // (shiftId, workerId) уникальная пара
  for (const [si, wi, status, initiator, message] of APPS) {
    const key = `${shiftIds[si]}|${workerIds[wi]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await prisma.application.create({
      data: {
        shiftId: shiftIds[si],
        workerId: workerIds[wi],
        status,
        initiator: initiator ?? "WORKER",
        message: message ?? null,
      },
    });
    if (status === "HIRED") {
      hiredCounts.set(shiftIds[si], (hiredCounts.get(shiftIds[si]) ?? 0) + 1);
    }
  }
  for (const [sid, hired] of hiredCounts) {
    const v = await prisma.shift.findUnique({ where: { id: sid } });
    if (!v) continue;
    await prisma.shift.update({
      where: { id: sid },
      data: {
        hiredCount: hired,
        status: hired >= v.headcount ? "CLOSED" : "OPEN",
      },
    });
  }

  console.log(`✓ ${HOTELS.length} hotels, ${WORKERS.length} workers, ${SHIFTS.length} shifts, ${APPS.length} applications`);
  console.log("Login: https://horecago.tech/demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
