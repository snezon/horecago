import { describe, it, expect } from "vitest";
import {
  searchStations,
  parseMetroSelection,
  findStation,
  MAX_METRO_STATIONS,
} from "@/lib/domain/metro";

describe("searchStations", () => {
  it("совпадение с начала названия идёт выше совпадения в середине", () => {
    const names = searchStations("парк").map((s) => s.name);
    expect(names[0]).toBe("Парк культуры");
    expect(names).toContain("Технопарк");
    expect(names.indexOf("Парк культуры")).toBeLessThan(names.indexOf("Технопарк"));
  });

  it("регистр и ё не мешают", () => {
    expect(searchStations("ЩЁЛКОВСКАЯ").map((s) => s.name)).toContain("Щелковская");
    expect(searchStations("щелковская").map((s) => s.name)).toContain("Щелковская");
  });

  it("пустой запрос не подсказывает ничего", () => {
    expect(searchStations("  ")).toEqual([]);
  });

  it("у станции есть ветка и цвет — их видно в подсказке", () => {
    const [first] = searchStations("Тверская");
    expect(first.line).toBe("Замоскворецкая");
    expect(first.color).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("parseMetroSelection", () => {
  it("приводит к написанию справочника", () => {
    expect(parseMetroSelection("тверская, КИТАЙ-ГОРОД")).toEqual([
      "Тверская",
      "Китай-город",
    ]);
  });

  it("выбрасывает то, чего нет в справочнике", () => {
    expect(parseMetroSelection("Тверская, м. Тверская 7, Хогвартс")).toEqual([
      "Тверская",
    ]);
  });

  it("повторы схлопываются", () => {
    expect(parseMetroSelection("Тверская, тверская")).toEqual(["Тверская"]);
  });

  it("больше лимита не сохраняем", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Станция ${i}`);
    const real = ["Тверская", "Китай-город", "Сокол", "Динамо", "Курская",
      "Таганская", "Полянка", "Отрадное", "Аэропорт", "Бауманская", "Смоленская"];
    const parsed = parseMetroSelection([...real, ...many].join(","));
    expect(parsed).toHaveLength(MAX_METRO_STATIONS);
  });

  it("пустая строка — пустой выбор", () => {
    expect(parseMetroSelection("")).toEqual([]);
  });
});

describe("findStation", () => {
  it("находит по неточному написанию", () => {
    expect(findStation("  щёлковская  ")?.name).toBe("Щелковская");
  });
});
