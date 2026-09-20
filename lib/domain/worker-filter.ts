import { isMedBookExpired } from "@/lib/domain/med-book";
import { sanitizeMetroInput, stationKey } from "@/lib/domain/metro-input";

export interface WorkerFilters {
  city: string | null;
  /** Одна или несколько станций через запятую: подходит совпадение по любой. */
  metro: string | null;
  medBook: boolean;
  workPermit: boolean;
  /** Ставка работника не выше этой суммы — для подбора под конкретную смену. */
  maxPayment: number | null;
}

export interface FilterableProfile {
  city: string | null;
  metro: string | null;
  hasMedBook: boolean;
  medBookExpiresAt: Date | null;
  hasWorkPermit: boolean;
  minPayment: number | null;
}

export const EMPTY_FILTERS: WorkerFilters = {
  city: null,
  metro: null,
  medBook: false,
  workPermit: false,
  maxPayment: null,
};

export function hasAnyFilter(f: WorkerFilters): boolean {
  return Boolean(
    f.city?.trim() || f.metro?.trim() || f.medBook || f.workPermit || f.maxPayment,
  );
}

/**
 * Отбор соискателей по условиям заказчика или агентства. Незаданное условие
 * никого не отсеивает — фильтр без ответа хуже, чем широкий список.
 *
 * `on` — дата, к которой медкнижка должна действовать: при подборе под смену
 * это дата смены, в обычном поиске — сегодня.
 */
export function matchesFilters(
  profile: FilterableProfile | null | undefined,
  filters: WorkerFilters,
  on: Date,
): boolean {
  if (!profile) return false;

  if (filters.city?.trim()) {
    const wanted = filters.city.trim().toLowerCase();
    if ((profile.city ?? "").trim().toLowerCase() !== wanted) return false;
  }

  if (filters.metro?.trim()) {
    const wanted = new Set(sanitizeMetroInput(filters.metro).map(stationKey));
    const has = sanitizeMetroInput(profile.metro ?? "").some((s) =>
      wanted.has(stationKey(s)),
    );
    if (!has) return false;
  }

  if (filters.medBook) {
    if (!profile.hasMedBook) return false;
    if (isMedBookExpired(profile.medBookExpiresAt, on)) return false;
  }

  if (filters.workPermit && !profile.hasWorkPermit) return false;

  if (filters.maxPayment != null && profile.minPayment != null) {
    if (profile.minPayment > filters.maxPayment) return false;
  }

  return true;
}

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
