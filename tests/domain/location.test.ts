import { describe, it, expect } from "vitest";
import { locationLine } from "@/lib/domain/location";

describe("locationLine", () => {
  it("город и станции разделяет точкой", () => {
    expect(locationLine({ city: "Москва", metro: "Тверская, Курская" })).toBe(
      "Москва · Тверская, Курская",
    );
  });

  it("город без станций — только город", () => {
    expect(locationLine({ city: "Краснодар", metro: null })).toBe("Краснодар");
  });

  it("станции без города — только станции", () => {
    expect(locationLine({ city: null, metro: "Тверская" })).toBe("Тверская");
  });

  it("пустой профиль — пустая строка", () => {
    expect(locationLine(null)).toBe("");
    expect(locationLine({ city: "  ", metro: "" })).toBe("");
  });
});
