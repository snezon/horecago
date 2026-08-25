/**
 * Demo seed: 8 работодателей, 20 соискателей, ~250 смен — месяц истории назад
 * и вперёд до 31.12.2026, плюс отклики, найм и приглашения от HR.
 *
 * Идемпотентен: стирает всех пользователей @demo.horecago.test (каскадом уходят
 * их смены/отклики/документы) и создаёт данные заново. Реальные аккаунты не трогает.
 *
 * Запуск:  npx tsx prisma/seed-demo.ts
 * Горизонт: DEMO_END=2027-06-30 npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const DEMO_DOMAIN = "demo.horecago.test";
const END_DATE = new Date(`${process.env.DEMO_END ?? "2026-12-31"}T23:59:59`);
const PAST_DAYS = 30; // сколько дней истории (уже отработанных смен) сгенерировать назад

// Детерминированный PRNG: один и тот же прогон даёт одинаковую базу.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261231);
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p: number) => rnd() < p;
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Работодатели ───────────────────────────────────────────────────────────

const HOTELS = [
  { email: `hr1@${DEMO_DOMAIN}`, name: "Ольга Смирнова",   phone: "+7 495 555-01-11", hotelName: "Гранд Отель Москва",       address: "Москва, ул. Тверская, 9" },
  { email: `hr2@${DEMO_DOMAIN}`, name: "Игорь Петров",     phone: "+7 495 555-02-22", hotelName: "Hostel Beehive",           address: "Москва, ул. Земляной вал, 14" },
  { email: `hr3@${DEMO_DOMAIN}`, name: "Мария Лебедева",   phone: "+7 495 555-03-33", hotelName: "Ресторан Aria",            address: "Москва, Малая Бронная, 3" },
  { email: `hr4@${DEMO_DOMAIN}`, name: "Артём Гончаров",   phone: "+7 495 555-04-44", hotelName: "Апарт-отель Loft 12",      address: "Москва, Дербеневская наб., 7с2" },
  { email: `hr5@${DEMO_DOMAIN}`, name: "Юлия Романова",    phone: "+7 495 555-05-55", hotelName: "Кофейня «Зерно»",          address: "Москва, ул. Никольская, 10" },
  { email: `hr6@${DEMO_DOMAIN}`, name: "Сергей Данилов",   phone: "+7 495 555-06-66", hotelName: "Банкетный зал «Империя»",  address: "Москва, Кутузовский пр-т, 36" },
  { email: `hr7@${DEMO_DOMAIN}`, name: "Наталья Ким",      phone: "+7 495 555-07-77", hotelName: "Бутик-отель Chekhov",      address: "Москва, Малая Дмитровка, 25" },
  { email: `hr8@${DEMO_DOMAIN}`, name: "Павел Егоров",     phone: "+7 495 555-08-88", hotelName: "Столовая «Пресня»",        address: "Москва, Пресненская наб., 12" },
];

// ─── Соискатели ─────────────────────────────────────────────────────────────

const WORKERS = [
  { email: `w1@${DEMO_DOMAIN}`,  name: "Анна Петрова",      phone: "+7 916 100-01-01", address: "м. Маяковская",    about: "5 лет опыта в гостиницах 4*. Аккуратная, могу выходить в любые смены.",            positions: ["Горничная", "Ресепшн/Администратор"],      minPayment: 4000, availabilityNote: "Любые смены, кроме среды" },
  { email: `w2@${DEMO_DOMAIN}`,  name: "Михаил Иванов",     phone: "+7 916 100-02-02", address: "м. Курская",       about: "Шеф-повар с опытом 8 лет. Холодный/горячий цех. Готов на разовые смены.",          positions: ["Повар (линейный)", "Менеджер смены"],       minPayment: 5500, availabilityNote: "Будни, вечер" },
  { email: `w3@${DEMO_DOMAIN}`,  name: "Елена Соколова",    phone: "+7 916 100-03-03", address: "м. Чистые пруды",  about: "Бариста, обучение SCA. Английский B1. Свободна по утрам.",                          positions: ["Бариста", "Бармен"],                        minPayment: 3800, availabilityNote: "Утро, будни 7–15" },
  { email: `w4@${DEMO_DOMAIN}`,  name: "Дмитрий Волков",    phone: "+7 916 100-04-04", address: "м. Парк культуры", about: "Официант 3 года, рестораны a la carte. Беру вечерние смены.",                       positions: ["Официант", "Рунер"],                        minPayment: 3500, availabilityNote: "Вечера, выходные" },
  { email: `w5@${DEMO_DOMAIN}`,  name: "Ольга Кузнецова",   phone: "+7 916 100-05-05", address: "м. Полянка",       about: "Опыт ресепшн 2 года, английский B2. Готова на ночные смены.",                       positions: ["Хостес", "Ресепшн/Администратор"],          minPayment: 5000, availabilityNote: "Ночные смены, выходные" },
  { email: `w6@${DEMO_DOMAIN}`,  name: "Андрей Морозов",    phone: "+7 916 100-06-06", address: "м. Сокол",         about: "Повар горячего цеха, 4 года. Любые смены.",                                         positions: ["Повар (линейный)", "Кухонный работник"],    minPayment: 4500, availabilityNote: "Любые смены" },
  { email: `w7@${DEMO_DOMAIN}`,  name: "Виктория Новикова", phone: "+7 916 100-07-07", address: "м. Таганская",     about: "Активная, опыт официанта 1 год + бариста 6 мес.",                                   positions: ["Официант", "Бариста"],                      minPayment: 3500, availabilityNote: "Выходные, вечер будни" },
  { email: `w8@${DEMO_DOMAIN}`,  name: "Руслан Хайруллин",  phone: "+7 916 100-08-08", address: "м. Марьина Роща",  about: "Бармен 5 лет, классика и авторские коктейли. Есть медкнижка.",                      positions: ["Бармен", "Официант"],                       minPayment: 5000, availabilityNote: "Пт–вс, ночь" },
  { email: `w9@${DEMO_DOMAIN}`,  name: "Светлана Гусева",   phone: "+7 916 100-09-09", address: "м. Аэропорт",      about: "Горничная в апарт-отелях, работаю быстро, знаю химию и текстиль.",                  positions: ["Горничная", "Прачечная"],                   minPayment: 3600, availabilityNote: "Будни, день" },
  { email: `w10@${DEMO_DOMAIN}`, name: "Игорь Савельев",    phone: "+7 916 100-10-10", address: "м. Автозаводская", about: "Универсал: рунер, кухонный работник, разгрузка. Без опыта не боюсь.",               positions: ["Рунер", "Кухонный работник"],               minPayment: 3000, availabilityNote: "Любые смены" },
  { email: `w11@${DEMO_DOMAIN}`, name: "Алина Егорова",     phone: "+7 916 100-11-11", address: "м. Смоленская",    about: "Хостес в ресторанах премиум-сегмента, английский C1.",                              positions: ["Хостес", "Официант"],                       minPayment: 4200, availabilityNote: "Вечера, кроме понедельника" },
  { email: `w12@${DEMO_DOMAIN}`, name: "Николай Зайцев",    phone: "+7 916 100-12-12", address: "м. Тульская",      about: "Технический сотрудник: сантехника, электрика, мелкий ремонт.",                      positions: ["Технический персонал"],                     minPayment: 4000, availabilityNote: "Будни, день" },
  { email: `w13@${DEMO_DOMAIN}`, name: "Дарья Белова",      phone: "+7 916 100-13-13", address: "м. Багратионовская", about: "Бариста 2 года, спешелти-кофейни. Латте-арт, альтернатива.",                      positions: ["Бариста"],                                  minPayment: 3900, availabilityNote: "Утро и день, будни" },
  { email: `w14@${DEMO_DOMAIN}`, name: "Тимур Абдуллаев",   phone: "+7 916 100-14-14", address: "м. Динамо",        about: "Повар на банкетах, до 300 гостей. Работаю по стандартам HACCP.",                    positions: ["Повар (линейный)", "Менеджер смены"],       minPayment: 6000, availabilityNote: "Выходные, банкеты" },
  { email: `w15@${DEMO_DOMAIN}`, name: "Марина Филатова",   phone: "+7 916 100-15-15", address: "м. Электрозаводская", about: "Прачечная и хозблок в отеле 3*, 3 года. Аккуратность и скорость.",                positions: ["Прачечная", "Горничная"],                   minPayment: 3400, availabilityNote: "Будни, утро" },
  { email: `w16@${DEMO_DOMAIN}`, name: "Кирилл Логинов",    phone: "+7 916 100-16-16", address: "м. Новослободская", about: "Швейцар/посыльный в отеле 5*, презентабельный вид, английский A2.",                positions: ["Швейцар/Посыльный", "Технический персонал"], minPayment: 3800, availabilityNote: "Любые смены" },
  { email: `w17@${DEMO_DOMAIN}`, name: "Екатерина Жукова",  phone: "+7 916 100-17-17", address: "м. Академическая", about: "Администратор ресепшн, Opera PMS, Bnovo. Опыт 4 года.",                             positions: ["Ресепшн/Администратор", "Менеджер смены"],  minPayment: 5500, availabilityNote: "Сутки через трое" },
  { email: `w18@${DEMO_DOMAIN}`, name: "Артём Соловьёв",    phone: "+7 916 100-18-18", address: "м. Бауманская",    about: "Официант банкетов и фуршетов, опыт 2 года. Есть чёрный низ / белый верх.",          positions: ["Официант", "Рунер"],                        minPayment: 3600, availabilityNote: "Выходные, вечер" },
  { email: `w19@${DEMO_DOMAIN}`, name: "Лилия Ахметова",    phone: "+7 916 100-19-19", address: "м. Отрадное",      about: "Кухонный работник, заготовки, посудомоечная зона. Медкнижка есть.",                 positions: ["Кухонный работник", "Прачечная"],           minPayment: 3200, availabilityNote: "Будни, день" },
  { email: `w20@${DEMO_DOMAIN}`, name: "Владислав Титов",   phone: "+7 916 100-20-20", address: "м. Войковская",    about: "Менеджер смены в сетевом общепите, 3 года. Закрываю кассу и график.",               positions: ["Менеджер смены", "Официант"],               minPayment: 6000, availabilityNote: "Любые смены" },
];

// Кто снят с ленты соискателей (нашёл работу) — для реалистичности
const NOT_LOOKING = new Set([`w9@${DEMO_DOMAIN}`, `w13@${DEMO_DOMAIN}`, `w20@${DEMO_DOMAIN}`]);

// ─── Шаблоны смен ───────────────────────────────────────────────────────────

type Tpl = {
  hr: number;
  position: string;
  title: string;
  description: string;
  payment: number;
  paymentNote?: string;
  startHour: number;
  durationHours: number;
  headcount: [number, number];
  season?: "NY"; // только вторая половина декабря
  weekendOnly?: boolean;
};

const TEMPLATES: Tpl[] = [
  // 0 — Гранд Отель Москва (премиум, 4*)
  { hr: 0, position: "Горничная",             title: "Горничная, утренняя смена",        description: "Уборка номеров по стандартам сети 4*. Питание в столовой для персонала.",        payment: 4500, startHour: 8,  durationHours: 8,  headcount: [2, 4] },
  { hr: 0, position: "Горничная",             title: "Горничная, дневная смена",         description: "Уборка номеров, бельё, минибар, инвентаризация.",                                 payment: 4500, startHour: 12, durationHours: 8,  headcount: [1, 3] },
  { hr: 0, position: "Ресепшн/Администратор", title: "Ночной ресепшн (английский)",      description: "Заселение/выселение, работа в Opera PMS. Английский B2 обязателен.",              payment: 6500, paymentNote: "+ такси домой", startHour: 22, durationHours: 10, headcount: [1, 1] },
  { hr: 0, position: "Хостес",                title: "Хостес в лобби",                   description: "Встреча гостей, координация с консьерж-сервисом.",                                payment: 4800, startHour: 10, durationHours: 8,  headcount: [1, 2] },
  { hr: 0, position: "Швейцар/Посыльный",     title: "Посыльный (bellboy), день",        description: "Багаж гостей, встреча у входа, помощь консьержу. Форму выдаём.",                  payment: 4000, paymentNote: "+ чай", startHour: 9,  durationHours: 9,  headcount: [1, 2] },
  { hr: 0, position: "Прачечная",             title: "Оператор прачечной",               description: "Стирка и глажка отельного текстиля, работа с промышленными машинами.",            payment: 3800, startHour: 8,  durationHours: 10, headcount: [1, 2] },
  { hr: 0, position: "Официант",              title: "Официант на завтраки (шведский стол)", description: "Подготовка линии, обслуживание зала завтраков, уборка.",                      payment: 3900, startHour: 6,  durationHours: 7,  headcount: [2, 3] },

  // 1 — Hostel Beehive (бюджет)
  { hr: 1, position: "Горничная",             title: "Уборка хостела, утро",             description: "Общие зоны, кухня, кровати. Дружный коллектив, чай/кофе бесплатно.",              payment: 3500, startHour: 9,  durationHours: 6,  headcount: [1, 3] },
  { hr: 1, position: "Хостес",                title: "Дежурный администратор хостела",   description: "Заселение гостей, ответы на вопросы, контроль чистоты. Разговорный английский.",  payment: 4000, startHour: 14, durationHours: 8,  headcount: [1, 1] },
  { hr: 1, position: "Технический персонал",  title: "Технический сотрудник, день",      description: "Мелкий ремонт, замена лампочек, доставка вещей. Без специального опыта.",         payment: 3200, startHour: 10, durationHours: 8,  headcount: [1, 1] },
  { hr: 1, position: "Ресепшн/Администратор", title: "Ночной администратор хостела",     description: "Ночная стойка, поздние заселения, контроль тишины. Можно спать в перерывах.",     payment: 3800, startHour: 21, durationHours: 11, headcount: [1, 1] },

  // 2 — Ресторан Aria (общепит, a la carte)
  { hr: 2, position: "Повар (линейный)",      title: "Повар горячего цеха, ужин",        description: "Заготовки днём, отдача вечером. Опыт от 2 лет. Питание включено.",                payment: 5500, startHour: 14, durationHours: 10, headcount: [1, 2] },
  { hr: 2, position: "Кухонный работник",     title: "Помощник повара, бранч",           description: "Заготовки, чистка овощей, помощь горячему цеху. Без опыта рассмотрим.",           payment: 3800, startHour: 9,  durationHours: 8,  headcount: [1, 2] },
  { hr: 2, position: "Официант",              title: "Официант, ужин (a la carte)",      description: "Сервис гостей по стандартам. Чаевые делятся через tronc.",                        payment: 3500, paymentNote: "+ чай 2–4 т", startHour: 17, durationHours: 7,  headcount: [2, 4] },
  { hr: 2, position: "Официант",              title: "Официант, воскресный бранч",       description: "Активный поток, английский на уровне меню.",                                     payment: 4200, paymentNote: "+ чай", startHour: 11, durationHours: 6,  headcount: [2, 3], weekendOnly: true },
  { hr: 2, position: "Бармен",                title: "Бармен, вечерний сервис",          description: "Авторские коктейли, опыт от 1 года. Чаевые щедрые.",                              payment: 5000, paymentNote: "+ чай", startHour: 18, durationHours: 8,  headcount: [1, 1] },
  { hr: 2, position: "Рунер",                 title: "Рунер, ужин",                      description: "Доставка блюд из кухни в зал. Без опыта — обучим на месте.",                      payment: 3000, paymentNote: "+ чай", startHour: 18, durationHours: 6,  headcount: [1, 2] },
  { hr: 2, position: "Менеджер смены",        title: "Менеджер зала, вечер",             description: "Рассадка, работа с гостями, закрытие кассы и отчёт.",                             payment: 6500, startHour: 16, durationHours: 9,  headcount: [1, 1] },

  // 3 — Апарт-отель Loft 12
  { hr: 3, position: "Горничная",             title: "Уборка апартаментов после выезда", description: "Полная уборка студий, смена белья, фотоотчёт в чате. Сдельно по 3 объектам.",     payment: 4200, startHour: 11, durationHours: 8,  headcount: [1, 3] },
  { hr: 3, position: "Ресепшн/Администратор", title: "Администратор апарт-отеля",        description: "Заселение, Bnovo, работа с отзывами на площадках.",                               payment: 5000, startHour: 9,  durationHours: 12, headcount: [1, 1] },
  { hr: 3, position: "Технический персонал",  title: "Мастер на объекты, день",          description: "Мелкий ремонт в апартаментах: сантехника, мебель, техника.",                      payment: 4300, startHour: 10, durationHours: 8,  headcount: [1, 1] },
  { hr: 3, position: "Прачечная",             title: "Приём и выдача белья",             description: "Сортировка, приём из прачечной, комплектация по объектам.",                       payment: 3300, startHour: 8,  durationHours: 7,  headcount: [1, 1] },

  // 4 — Кофейня «Зерно»
  { hr: 4, position: "Бариста",               title: "Бариста, утренняя смена",          description: "Эспрессо-бар, латте-арт приветствуется. Кофе и завтрак за счёт заведения.",       payment: 4000, startHour: 7,  durationHours: 7,  headcount: [1, 2] },
  { hr: 4, position: "Бариста",               title: "Бариста, вечерняя смена",          description: "Вечерний поток, закрытие точки, мойка оборудования.",                             payment: 3800, paymentNote: "+ чай", startHour: 14, durationHours: 7,  headcount: [1, 1] },
  { hr: 4, position: "Официант",              title: "Официант в кофейню",               description: "Работа в зале на 12 столов, вынос, касса.",                                       payment: 3400, paymentNote: "+ чай", startHour: 10, durationHours: 8,  headcount: [1, 2] },
  { hr: 4, position: "Кухонный работник",     title: "Помощник на кухню кофейни",        description: "Сборка сэндвичей и салатов, мойка. Медкнижка обязательна.",                       payment: 3200, startHour: 8,  durationHours: 8,  headcount: [1, 1] },

  // 5 — Банкетный зал «Империя»
  { hr: 5, position: "Официант",              title: "Официант на банкет",               description: "Банкет 120 гостей, работа по схеме рассадки. Чёрный низ / белый верх.",           payment: 4000, paymentNote: "выплата в тот же вечер", startHour: 16, durationHours: 8,  headcount: [4, 8] },
  { hr: 5, position: "Рунер",                 title: "Рунер на банкет",                  description: "Подача с кухни, вынос грязной посуды. Без опыта, обучение на месте.",             payment: 3200, startHour: 16, durationHours: 8,  headcount: [2, 4] },
  { hr: 5, position: "Повар (линейный)",      title: "Повар на банкетную линию",         description: "Отдача горячего на 150+ порций, работа в бригаде.",                               payment: 6000, startHour: 12, durationHours: 10, headcount: [1, 3] },
  { hr: 5, position: "Бармен",                title: "Бармен на выездной бар",           description: "Велком-дринк, вино и коктейли на банкете. Инвентарь наш.",                        payment: 5200, paymentNote: "+ чай", startHour: 17, durationHours: 8,  headcount: [1, 2] },
  { hr: 5, position: "Кухонный работник",     title: "Посудомойка на банкет",            description: "Работа с посудомоечной машиной, вынос, уборка после мероприятия.",                payment: 3000, startHour: 17, durationHours: 8,  headcount: [1, 2] },
  { hr: 5, position: "Официант",              title: "Официант на новогодний корпоратив", description: "Корпоратив 200 гостей, банкетная подача. Оплата повышенная, ужин для персонала.", payment: 5500, paymentNote: "+ чай, оплата в тот же вечер", startHour: 17, durationHours: 9,  headcount: [6, 12], season: "NY" },
  { hr: 5, position: "Рунер",                 title: "Рунер на новогодние мероприятия",  description: "Пиковый сезон корпоративов, подача и вынос. Берём без опыта.",                    payment: 4200, startHour: 17, durationHours: 9,  headcount: [3, 6], season: "NY" },
  { hr: 5, position: "Хостес",                title: "Хостес на корпоратив",             description: "Встреча гостей, гардероб-контроль, рассадка по схеме.",                           payment: 4800, startHour: 16, durationHours: 8,  headcount: [1, 3], season: "NY" },

  // 6 — Бутик-отель Chekhov
  { hr: 6, position: "Горничная",             title: "Горничная в бутик-отеле",          description: "12 номеров, повышенные стандарты чистоты. Спокойный темп.",                       payment: 4300, startHour: 9,  durationHours: 8,  headcount: [1, 2] },
  { hr: 6, position: "Ресепшн/Администратор", title: "Администратор, дневная смена",     description: "Стойка приёма, бронирования, работа с гостевыми запросами. Английский B1.",       payment: 5200, startHour: 8,  durationHours: 12, headcount: [1, 1] },
  { hr: 6, position: "Официант",              title: "Официант на завтраки",             description: "Завтраки по меню (не шведский стол), 12 столиков.",                               payment: 3700, paymentNote: "+ чай", startHour: 7,  durationHours: 6,  headcount: [1, 2] },
  { hr: 6, position: "Швейцар/Посыльный",     title: "Швейцар у входа",                  description: "Встреча гостей, помощь с багажом, вызов такси. Форма выдаётся.",                  payment: 3900, paymentNote: "+ чай", startHour: 12, durationHours: 9,  headcount: [1, 1] },

  // 7 — Столовая «Пресня» (корпоративное питание)
  { hr: 7, position: "Кухонный работник",     title: "Кухонный работник, будни",         description: "Заготовки, раздача, мойка. Стабильный график, обед бесплатно.",                   payment: 3300, startHour: 7,  durationHours: 9,  headcount: [1, 3] },
  { hr: 7, position: "Повар (линейный)",      title: "Повар на раздачу, бизнес-ланч",    description: "Приготовление комплексных обедов на 400 человек. Опыт от 1 года.",                payment: 4800, startHour: 6,  durationHours: 9,  headcount: [1, 2] },
  { hr: 7, position: "Официант",              title: "Сотрудник линии раздачи",          description: "Порционирование, работа с гостями, поддержание чистоты линии.",                   payment: 3200, startHour: 10, durationHours: 7,  headcount: [1, 3] },
  { hr: 7, position: "Менеджер смены",        title: "Менеджер смены столовой",          description: "Контроль линии, списания, отчёт по кассе. Опыт в общепите обязателен.",           payment: 5800, startHour: 7,  durationHours: 10, headcount: [1, 1] },
];

const INVITE_MESSAGES = [
  (n: string, p: string) => `${n}, у нас открыта смена «${p}». Подойдёте?`,
  (n: string, p: string) => `${n}, увидели ваш профиль — нужна ${p.toLowerCase()}. Готовы выйти?`,
  (n: string, p: string) => `Здравствуйте, ${n}! Приглашаем на смену, позиция «${p}». Ставку обсудим.`,
  (n: string, p: string) => `${n}, вы уже работали на похожих сменах — зовём к нам на «${p}».`,
  (n: string) => `${n}, подтвердите, пожалуйста, готовность — держим место за вами.`,
];

const DEMO_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 47>>stream\nBT /F1 24 Tf 100 700 Td (Demo document) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000054 00000 n \n0000000098 00000 n \n0000000182 00000 n \n0000000277 00000 n \ntrailer<</Size 6/Root 1 0 R>>startxref\n339\n%%EOF",
  "binary",
);

// ─── Генерация смен ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function dayStart(offsetFromToday: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetFromToday);
  return d;
}

/** Сколько смен публикуется на день с таким отступом от сегодня. */
function shiftsForDay(offset: number): number {
  if (offset < 0) return chance(0.5) ? 1 : 2;      // история
  if (offset <= 13) return int(3, 5);               // ближайшие две недели — плотно
  if (offset <= 44) return int(2, 3);               // следующий месяц
  if (offset <= 89) return int(1, 2);               // осень
  return chance(0.7) ? 1 : 0;                       // ноябрь-декабрь — реже
}

type PlannedShift = {
  tpl: Tpl;
  offset: number;
  start: Date;
  end: Date;
  payment: number;
  headcount: number;
};

function buildShifts(): PlannedShift[] {
  const today = dayStart(0);
  const horizon = Math.max(0, Math.round((END_DATE.getTime() - today.getTime()) / DAY_MS));
  const out: PlannedShift[] = [];

  for (let offset = -PAST_DAYS; offset <= horizon; offset++) {
    const day = dayStart(offset);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isNYSeason = day.getMonth() === 11 && day.getDate() >= 8; // с 8 декабря — сезон корпоративов

    const pool = TEMPLATES.filter((t) => {
      if (t.season === "NY" && !isNYSeason) return false;
      if (t.weekendOnly && !isWeekend) return false;
      return true;
    });
    // В сезон корпоративов новогодние смены встречаются чаще
    const weighted = isNYSeason ? [...pool, ...pool.filter((t) => t.season === "NY")] : pool;

    const usedHere = new Set<string>();
    let n = shiftsForDay(offset);
    if (isNYSeason) n += 1;

    for (let i = 0; i < n; i++) {
      let tpl = pick(weighted);
      let guard = 0;
      while (usedHere.has(tpl.title) && guard++ < 8) tpl = pick(weighted);
      usedHere.add(tpl.title);

      const start = dayStart(offset);
      start.setHours(tpl.startHour, 0, 0, 0);
      const end = new Date(start.getTime() + tpl.durationHours * 3600_000);

      const jitter = 0.92 + rnd() * 0.16;
      const payment = Math.round((tpl.payment * jitter) / 100) * 100;

      out.push({
        tpl,
        offset,
        start,
        end,
        payment,
        headcount: int(tpl.headcount[0], tpl.headcount[1]),
      });
    }
  }
  return out;
}

async function main() {
  // 1. Стереть прошлые демо-данные
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true },
  });
  if (demoUsers.length) {
    await prisma.user.deleteMany({ where: { id: { in: demoUsers.map((u) => u.id) } } });
    console.log(`Wiped ${demoUsers.length} demo users.`);
  }

  // 2. Справочник позиций
  const positions = await prisma.position.findMany();
  const positionByName = new Map(positions.map((p) => [p.name, p.id]));
  const missing = [...new Set(TEMPLATES.map((t) => t.position))].filter((p) => !positionByName.has(p));
  if (missing.length) {
    throw new Error(`Нет позиций в справочнике: ${missing.join(", ")}. Сначала: npx prisma db seed`);
  }

  // 3. Работодатели
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

  // 4. Соискатели + документы
  const uploadDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  const demoFile = "demo-passport.pdf";
  await writeFile(path.join(uploadDir, demoFile), DEMO_PDF);

  const workerIds: string[] = [];
  const workerPositions: Set<string>[] = [];
  for (const w of WORKERS) {
    const docs: { kind: string; filename: string; url: string }[] = [];
    if (chance(0.9)) docs.push({ kind: "PASSPORT", filename: "passport.pdf", url: `/uploads/${demoFile}` });
    if (chance(0.7)) docs.push({ kind: "MED_BOOK", filename: "med-book.pdf", url: `/uploads/${demoFile}` });

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
            isLookingForWork: !NOT_LOOKING.has(w.email),
            skills: {
              create: w.positions
                .map((name) => positionByName.get(name))
                .filter((id): id is number => Boolean(id))
                .map((positionId) => ({ positionId })),
            },
            documents: { create: docs },
          },
        },
      },
    });
    workerIds.push(u.id);
    workerPositions.push(new Set(w.positions));
  }

  // 5. Смены
  const planned = buildShifts();
  const shiftIds: string[] = [];
  for (const s of planned) {
    const created = await prisma.shift.create({
      data: {
        hrId: hrIds[s.tpl.hr],
        positionId: positionByName.get(s.tpl.position)!,
        title: s.tpl.title,
        description: s.tpl.description,
        payment: s.payment,
        paymentNote: s.tpl.paymentNote,
        shiftStart: s.start,
        shiftEnd: s.end,
        address: HOTELS[s.tpl.hr].address,
        headcount: s.headcount,
        // публикация: за 3–20 дней до смены, но не в будущем
        createdAt: new Date(Math.min(Date.now(), s.start.getTime() - int(3, 20) * DAY_MS)),
      },
    });
    shiftIds.push(created.id);
  }

  // 6. Отклики, найм, приглашения
  let hired = 0, pending = 0, rejected = 0, invites = 0;

  for (let si = 0; si < planned.length; si++) {
    const s = planned[si];
    // Кандидаты: сначала те, у кого есть нужный навык
    const fit = workerIds.map((_, wi) => wi).filter((wi) => workerPositions[wi].has(s.tpl.position));
    const rest = workerIds.map((_, wi) => wi).filter((wi) => !workerPositions[wi].has(s.tpl.position));
    const candidates = [...shuffled(fit), ...shuffled(rest)];

    let want: number;
    let toHire: number;
    if (s.offset < 0) {
      // прошедшие смены: закрыты и отработаны
      toHire = s.headcount;
      want = s.headcount + int(0, 2);
    } else if (s.offset <= 7) {
      toHire = int(0, s.headcount);
      want = s.headcount + int(0, 2);
    } else if (s.offset <= 30) {
      toHire = chance(0.35) ? 1 : 0;
      want = int(1, Math.min(3, s.headcount + 1));
    } else {
      toHire = 0;
      want = chance(0.55) ? 1 : 0;
    }
    want = Math.min(want, candidates.length);

    const chosen = candidates.slice(0, want);
    let hiredHere = 0;
    for (let k = 0; k < chosen.length; k++) {
      const wi = chosen[k];
      let status: "PENDING" | "HIRED" | "REJECTED" = "PENDING";
      if (hiredHere < toHire) {
        status = "HIRED";
        hiredHere++;
      } else if (s.offset < 0 && chance(0.5)) {
        status = "REJECTED";
      }

      // Часть откликов — приглашения от HR
      const isInvite = status !== "REJECTED" && chance(0.12);
      const msgFn = pick(INVITE_MESSAGES);
      const createdAt = new Date(
        Math.min(Date.now(), s.start.getTime() - int(1, 12) * DAY_MS),
      );

      await prisma.application.create({
        data: {
          shiftId: shiftIds[si],
          workerId: workerIds[wi],
          status,
          initiator: isInvite ? "HR" : "WORKER",
          message: isInvite ? msgFn(WORKERS[wi].name.split(" ")[0], s.tpl.position) : null,
          createdAt,
        },
      });

      if (isInvite) invites++;
      if (status === "HIRED") hired++;
      else if (status === "PENDING") pending++;
      else rejected++;
    }

    if (hiredHere > 0 || s.offset < 0) {
      await prisma.shift.update({
        where: { id: shiftIds[si] },
        data: {
          hiredCount: hiredHere,
          status: hiredHere >= s.headcount ? "CLOSED" : "OPEN",
        },
      });
    }
  }

  const openFuture = planned.filter((s, i) => s.offset >= 0).length;
  const first = planned[0]?.start, last = planned[planned.length - 1]?.start;
  console.log(
    `✓ ${HOTELS.length} работодателей, ${WORKERS.length} соискателей, ${planned.length} смен ` +
      `(${openFuture} с сегодняшнего дня), откликов: ${hired + pending + rejected} ` +
      `(нанято ${hired}, ждут ${pending}, отклонено ${rejected}, приглашений от HR ${invites})`,
  );
  console.log(`  Диапазон смен: ${first?.toLocaleDateString("ru-RU")} — ${last?.toLocaleDateString("ru-RU")}`);
  console.log("  Вход в демо: /demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
