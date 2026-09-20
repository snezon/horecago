import { describe, it, expect } from "vitest";
import {
  sanitizeMetroInput,
  stationKey,
  MAX_METRO_STATIONS,
} from "@/lib/domain/metro-input";

describe("sanitizeMetroInput", () => {
  it("режет по запятым и убирает лишние пробелы", () => {
    expect(sanitizeMetroInput(" Тверская ,  Китай-город ")).toEqual([
      "Тверская",
      "Китай-город",
    ]);
  });

  it("срезает приставку «м.» и «метро» — так писали до справочника", () => {
    expect(sanitizeMetroInput("м. Маяковская, метро Курская")).toEqual([
      "Маяковская",
      "Курская",
    ]);
  });

  it("повторы схлопываются без оглядки на регистр и ё", () => {
    expect(sanitizeMetroInput("Щёлковская, щелковская")).toEqual(["Щёлковская"]);
  });

  it("больше лимита не берём", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Станция ${i}`).join(",");
    expect(sanitizeMetroInput(many)).toHaveLength(MAX_METRO_STATIONS);
  });

  it("пустые куски и слишком длинные имена отбрасываются", () => {
    expect(sanitizeMetroInput("Тверская, ,  , " + "я".repeat(61))).toEqual([
      "Тверская",
    ]);
  });
});

describe("stationKey", () => {
  it("сводит регистр, ё и приставку к одному виду", () => {
    expect(stationKey("м. Щёлковская")).toBe(stationKey("ЩЕЛКОВСКАЯ"));
  });
});
