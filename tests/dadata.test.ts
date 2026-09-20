import { describe, it, expect } from "vitest";
import { parseMetroSuggestions, parseCitySuggestions } from "@/lib/dadata";

describe("parseMetroSuggestions", () => {
  it("разбирает ответ DaData и добавляет решётку к цвету", () => {
    expect(
      parseMetroSuggestions({
        suggestions: [
          {
            data: {
              name: "Александровский сад",
              line_name: "Филёвская",
              color: "1EBCEF",
              city: "Москва",
            },
          },
        ],
      }),
    ).toEqual([
      {
        name: "Александровский сад",
        line: "Филёвская",
        color: "#1EBCEF",
        city: "Москва",
      },
    ]);
  });

  it("станции без имени пропускает, битый цвет заменяет нейтральным", () => {
    const parsed = parseMetroSuggestions({
      suggestions: [
        { data: { name: "  ", color: "1EBCEF" } },
        { data: { name: "Без цвета", color: "зелёненький" } },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("Без цвета");
    expect(parsed[0].color).toBe("#94A3B8");
  });

  it("мусор вместо ответа не роняет разбор", () => {
    expect(parseMetroSuggestions(null)).toEqual([]);
    expect(parseMetroSuggestions({ suggestions: "нет" })).toEqual([]);
  });
});

describe("parseCitySuggestions", () => {
  it("берёт город, а для посёлка — settlement", () => {
    expect(
      parseCitySuggestions({
        suggestions: [
          { data: { city: "Краснодар" } },
          { data: { city: null, settlement: "Емельяново" } },
        ],
      }),
    ).toEqual(["Краснодар", "Емельяново"]);
  });

  it("повторы схлопывает", () => {
    expect(
      parseCitySuggestions({
        suggestions: [{ data: { city: "Казань" } }, { data: { city: "Казань" } }],
      }),
    ).toEqual(["Казань"]);
  });
});
