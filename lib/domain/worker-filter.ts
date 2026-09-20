import type { Prisma } from "@prisma/client";
import { cityKeyOf, metroKeysOf } from "@/lib/domain/worker-index";

export interface WorkerFilters {
  city: string | null;
  /** Одна или несколько станций через запятую: подходит совпадение по любой. */
  metro: string | null;
  medBook: boolean;
  workPermit: boolean;
  /** Ставка работника не выше этой суммы — для подбора под конкретную смену. */
  maxPayment: number | null;
}

export const EMPTY_FILTERS: WorkerFilters = {
  city: null,
  metro: null,
  medBook: false,
  workPermit: false,
  maxPayment: null,
};

/** Фильтры из строки запроса — общий разбор для заказчика и агентства. */
export function filtersFromParams(params: {
  city?: string;
  metro?: string;
  med?: string;
  permit?: string;
}): WorkerFilters {
  return {
    city: params.city?.trim() || null,
    metro: params.metro?.trim() || null,
    medBook: params.med === "1",
    workPermit: params.permit === "1",
    maxPayment: null,
  };
}

/**
 * Условия отбора как запрос к базе, а не перебор в приложении: город и станции
 * лежат нормализованными (см. worker-index), поэтому фильтр переживёт рост
 * базы и не зависит от того, как SQLite сравнивает кириллицу.
 *
 * `on` — дата, к которой медкнижка должна действовать: при подборе под смену
 * это дата смены, в обычном поиске — сегодня.
 */
export function workerFilterWhere(
  filters: WorkerFilters,
  on: Date,
): Prisma.WorkerProfileWhereInput {
  const where: Prisma.WorkerProfileWhereInput = {};

  const cityKey = cityKeyOf(filters.city);
  if (cityKey) where.cityKey = cityKey;

  const stations = metroKeysOf(filters.metro).map((s) => s.stationKey);
  if (stations.length > 0) {
    where.metroStations = { some: { stationKey: { in: stations } } };
  }

  if (filters.medBook) {
    where.hasMedBook = true;
    // Срок может быть не указан вовсе — это «книжка есть, дату не назвал»,
    // а не «просрочена»: отсеивать такого человека фильтр не должен.
    where.OR = [
      { medBookExpiresAt: null },
      { medBookExpiresAt: { gte: startOfDay(on) } },
    ];
  }

  if (filters.workPermit) where.hasWorkPermit = true;

  if (filters.maxPayment != null) {
    where.AND = [
      {
        OR: [
          { minPayment: null },
          { minPayment: { lte: filters.maxPayment } },
        ],
      },
    ];
  }

  return where;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
