import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import {
  workerFilterWhere,
  filtersFromParams,
  EMPTY_FILTERS,
  type WorkerFilters,
} from "@/lib/domain/worker-filter";
import { reindexWorker } from "@/lib/domain/worker-index";

const TODAY = new Date(2026, 8, 20);

async function addWorker(
  name: string,
  profile: {
    city?: string | null;
    metro?: string | null;
    hasMedBook?: boolean;
    medBookExpiresAt?: Date | null;
    hasWorkPermit?: boolean;
    minPayment?: number | null;
  },
) {
  const user = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "WORKER", name },
  });
  await prisma.workerProfile.create({
    data: { userId: user.id, ...profile },
  });
  await reindexWorker(user.id, profile.city ?? null, profile.metro ?? null);
  return user.id;
}

/** Кого вернёт база по этим условиям — именно так страницы и спрашивают. */
async function found(filters: WorkerFilters, on: Date = TODAY) {
  const rows = await prisma.user.findMany({
    where: { role: "WORKER", workerProfile: workerFilterWhere(filters, on) },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.name);
}

describe("отбор соискателей запросом к базе", () => {
  beforeEach(async () => {
    await resetDb();
    await addWorker("москвич", {
      city: "Москва",
      metro: "Тверская, Курская",
      hasMedBook: true,
      medBookExpiresAt: new Date(2027, 0, 1),
      minPayment: 3500,
    });
    await addWorker("казанец", {
      city: "Казань",
      metro: "Авиастроительная",
      hasMedBook: true,
      minPayment: 3000,
    });
    await addWorker("дорогой", {
      city: "Москва",
      metro: "Тверская",
      hasMedBook: false,
      hasWorkPermit: true,
      minPayment: 9000,
    });
    await addWorker("просроченный", {
      city: "Москва",
      metro: "Курская",
      hasMedBook: true,
      medBookExpiresAt: new Date(2026, 8, 19),
      minPayment: 3000,
    });
  });

  it("пустой отбор возвращает всех", async () => {
    expect(await found(EMPTY_FILTERS)).toEqual([
      "дорогой",
      "казанец",
      "москвич",
      "просроченный",
    ]);
  });

  it("город ищется без оглядки на регистр и ё", async () => {
    expect(await found({ ...EMPTY_FILTERS, city: "мОсКвА" })).toEqual([
      "дорогой",
      "москвич",
      "просроченный",
    ]);
    expect(await found({ ...EMPTY_FILTERS, city: "Казань" })).toEqual(["казанец"]);
  });

  it("по станциям достаточно одного совпадения, приставка «м.» не мешает", async () => {
    expect(await found({ ...EMPTY_FILTERS, metro: "м. Тверская" })).toEqual([
      "дорогой",
      "москвич",
    ]);
    expect(await found({ ...EMPTY_FILTERS, metro: "Курская, Отрадное" })).toEqual([
      "москвич",
      "просроченный",
    ]);
  });

  it("медкнижка проверяется на нужную дату", async () => {
    expect(await found({ ...EMPTY_FILTERS, medBook: true })).toEqual([
      "казанец",
      "москвич",
    ]);
    // На дату смены в прошлом просроченный ещё годится.
    expect(
      await found({ ...EMPTY_FILTERS, medBook: true }, new Date(2026, 8, 18)),
    ).toEqual(["казанец", "москвич", "просроченный"]);
  });

  it("разрешение на работу отсеивает тех, у кого его нет", async () => {
    expect(await found({ ...EMPTY_FILTERS, workPermit: true })).toEqual(["дорогой"]);
  });

  it("потолок ставки отсекает дорогих, но не тех, кто её не указал", async () => {
    await addWorker("безставки", { city: "Москва", metro: "Тверская" });
    expect(await found({ ...EMPTY_FILTERS, city: "Москва", maxPayment: 4000 })).toEqual([
      "безставки",
      "москвич",
      "просроченный",
    ]);
  });

  it("условия складываются", async () => {
    expect(
      await found({
        city: "Москва",
        metro: "Тверская",
        medBook: true,
        workPermit: false,
        maxPayment: 4000,
      }),
    ).toEqual(["москвич"]);
  });
});

describe("filtersFromParams", () => {
  it("читает строку запроса", () => {
    expect(filtersFromParams({ city: " Казань ", metro: "Тверская", med: "1" })).toEqual({
      city: "Казань",
      metro: "Тверская",
      medBook: true,
      workPermit: false,
      maxPayment: null,
    });
  });

  it("пустые значения не становятся условиями", () => {
    expect(filtersFromParams({ city: "  ", med: "0" })).toEqual(EMPTY_FILTERS);
  });
});
