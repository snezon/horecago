import { describe, it, expect } from "vitest";
import {
  matchesFilters,
  filtersFromParams,
  hasAnyFilter,
  EMPTY_FILTERS,
} from "@/lib/domain/worker-filter";

const TODAY = new Date(2026, 8, 20);

const profile = {
  city: "Москва",
  metro: "Тверская, Курская",
  hasMedBook: true,
  medBookExpiresAt: new Date(2027, 0, 1),
  hasWorkPermit: false,
  minPayment: 3500,
};

describe("matchesFilters", () => {
  it("пустой фильтр пропускает всех", () => {
    expect(matchesFilters(profile, EMPTY_FILTERS, TODAY)).toBe(true);
  });

  it("город сравнивается без оглядки на регистр", () => {
    expect(
      matchesFilters(profile, { ...EMPTY_FILTERS, city: "москва" }, TODAY),
    ).toBe(true);
    expect(
      matchesFilters(profile, { ...EMPTY_FILTERS, city: "Казань" }, TODAY),
    ).toBe(false);
  });

  it("по станциям достаточно одного совпадения", () => {
    expect(
      matchesFilters(profile, { ...EMPTY_FILTERS, metro: "Отрадное, Курская" }, TODAY),
    ).toBe(true);
    expect(
      matchesFilters(profile, { ...EMPTY_FILTERS, metro: "Отрадное" }, TODAY),
    ).toBe(false);
  });

  it("медкнижка должна действовать к нужной дате", () => {
    const filters = { ...EMPTY_FILTERS, medBook: true };
    expect(matchesFilters(profile, filters, TODAY)).toBe(true);
    expect(
      matchesFilters(
        { ...profile, medBookExpiresAt: new Date(2026, 8, 19) },
        filters,
        TODAY,
      ),
    ).toBe(false);
    expect(matchesFilters({ ...profile, hasMedBook: false }, filters, TODAY)).toBe(
      false,
    );
  });

  it("разрешение на работу отсеивает тех, у кого его нет", () => {
    const filters = { ...EMPTY_FILTERS, workPermit: true };
    expect(matchesFilters(profile, filters, TODAY)).toBe(false);
    expect(
      matchesFilters({ ...profile, hasWorkPermit: true }, filters, TODAY),
    ).toBe(true);
  });

  it("ставка выше потолка смены отсеивает, не указанная — нет", () => {
    const filters = { ...EMPTY_FILTERS, maxPayment: 4000 };
    expect(matchesFilters(profile, filters, TODAY)).toBe(true);
    expect(
      matchesFilters({ ...profile, minPayment: 6000 }, filters, TODAY),
    ).toBe(false);
    expect(matchesFilters({ ...profile, minPayment: null }, filters, TODAY)).toBe(
      true,
    );
  });

  it("без профиля никто не проходит", () => {
    expect(matchesFilters(null, EMPTY_FILTERS, TODAY)).toBe(false);
  });
});

describe("filtersFromParams", () => {
  it("читает строку запроса", () => {
    expect(
      filtersFromParams({ city: " Казань ", metro: "Тверская", med: "1" }),
    ).toEqual({
      city: "Казань",
      metro: "Тверская",
      medBook: true,
      workPermit: false,
      maxPayment: null,
    });
  });

  it("пустые значения не становятся условиями", () => {
    const f = filtersFromParams({ city: "  ", med: "0" });
    expect(hasAnyFilter(f)).toBe(false);
  });
});
