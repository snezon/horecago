import { describe, it, expect, vi, afterEach } from "vitest";
import {
  searchStationsOffline,
  findStationOffline,
  cityHasMetro,
  resolveStations,
  METRO_CITIES,
} from "@/lib/domain/metro";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("свой справочник", () => {
  it("знает все города РФ с метро", () => {
    expect(METRO_CITIES).toEqual([
      "Москва",
      "Санкт-Петербург",
      "Нижний Новгород",
      "Новосибирск",
      "Самара",
      "Екатеринбург",
      "Казань",
    ]);
    expect(cityHasMetro("казань")).toBe(true);
    expect(cityHasMetro("Краснодар")).toBe(false);
  });

  it("ищет станции в пределах города", () => {
    expect(searchStationsOffline("Казань", "авиа").map((s) => s.name)).toContain(
      "Авиастроительная",
    );
    expect(searchStationsOffline("Москва", "авиа").map((s) => s.name)).toContain(
      "Авиамоторная",
    );
    // «Авиамоторной» в Казани нет — города не перемешиваются.
    expect(
      searchStationsOffline("Казань", "авиа").map((s) => s.name),
    ).not.toContain("Авиамоторная");
  });

  it("совпадение с начала названия идёт выше совпадения в середине", () => {
    const names = searchStationsOffline("Москва", "парк").map((s) => s.name);
    expect(names.indexOf("Парк культуры")).toBeLessThan(names.indexOf("Технопарк"));
  });

  it("находит станцию по неточному написанию", () => {
    expect(findStationOffline("Москва", "  м. щёлковская ")?.name).toBe(
      "Щелковская",
    );
  });
});

describe("resolveStations", () => {
  it("приводит к написанию справочника, не трогая сеть", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(resolveStations("Москва", "тверская, КИТАЙ-ГОРОД")).resolves.toEqual([
      "Тверская",
      "Китай-город",
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("незнакомую станцию спрашивает у DaData и берёт её написание", async () => {
    vi.stubEnv("DADATA_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          suggestions: [
            { data: { name: "Новая", line_name: "Первая", color: "AABBCC", city: "Пермь" } },
          ],
        }),
      ),
    );

    await expect(resolveStations("Пермь", "новая")).resolves.toEqual(["Новая"]);
  });

  it("станцию, которой нет и у DaData, выбрасывает", async () => {
    vi.stubEnv("DADATA_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ suggestions: [] })));

    await expect(resolveStations("Пермь", "Хогвартс")).resolves.toEqual([]);
  });

  it("если DaData недоступна — сохраняем ввод, а не теряем его", async () => {
    vi.stubEnv("DADATA_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("сеть лежит");
    }));

    await expect(resolveStations("Пермь", "Новая")).resolves.toEqual(["Новая"]);
  });

  it("без ключа незнакомый город оставляем как ввели", async () => {
    vi.stubEnv("DADATA_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(resolveStations("Пермь", "Новая")).resolves.toEqual(["Новая"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
