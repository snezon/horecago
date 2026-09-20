import { METRO_STATIONS, type MetroStation } from "@/lib/data/metro-stations.generated";

/** Сколько станций работник может отметить: больше — уже «еду куда угодно». */
export const MAX_METRO_STATIONS = 10;

const byKey = new Map<string, MetroStation>(
  METRO_STATIONS.map((s) => [stationKey(s.name), s]),
);

/** Ключ сравнения: регистр и ё/е не должны мешать совпадению. */
export function stationKey(name: string): string {
  return name.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

export function findStation(name: string): MetroStation | undefined {
  return byKey.get(stationKey(name));
}

/**
 * Подсказки к вводу. Станции, начинающиеся с запроса, идут выше тех, где он
 * встретился в середине: человек печатает «пар» ради «Парка культуры», а не
 * ради «Технопарка».
 */
export function searchStations(query: string, limit = 8): MetroStation[] {
  const q = stationKey(query);
  if (!q) return [];
  const starts: MetroStation[] = [];
  const inside: MetroStation[] = [];
  for (const s of METRO_STATIONS) {
    const key = stationKey(s.name);
    if (key.startsWith(q)) starts.push(s);
    else if (key.includes(q)) inside.push(s);
    if (starts.length >= limit) break;
  }
  return [...starts, ...inside].slice(0, limit);
}

/**
 * Что действительно сохраняем из поля метро: только станции из справочника,
 * в его написании, без повторов и не больше MAX_METRO_STATIONS. Форма шлёт
 * обычную строку, и доверять ей нельзя — в базе должны лежать названия,
 * по которым потом можно искать, а не «м.Тверская» и «тверская/пушкинская».
 */
export function parseMetroSelection(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(",")) {
    const station = findStation(piece);
    if (!station) continue;
    const key = stationKey(station.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(station.name);
    if (out.length >= MAX_METRO_STATIONS) break;
  }
  return out;
}

export function formatMetroSelection(stations: string[]): string {
  return stations.join(", ");
}
