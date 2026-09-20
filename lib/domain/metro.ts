import {
  METRO_STATIONS_BY_CITY,
  METRO_CITIES,
  type MetroStation,
} from "@/lib/data/metro-stations.generated";
import { suggestMetro, hasDadataKey } from "@/lib/dadata";
import {
  MAX_METRO_STATIONS,
  sanitizeMetroInput,
  stationKey,
} from "@/lib/domain/metro-input";

export { METRO_CITIES };

export function cityHasMetro(city: string): boolean {
  return METRO_CITIES.some((c) => c.toLowerCase() === city.trim().toLowerCase());
}

function cityStations(city: string): MetroStation[] {
  const key = city.trim().toLowerCase();
  const match = METRO_CITIES.find((c) => c.toLowerCase() === key);
  return match ? METRO_STATIONS_BY_CITY[match] : [];
}

/**
 * Подсказки из своего справочника — запасной путь, когда DaData молчит.
 * Станции, начинающиеся с запроса, идут выше тех, где он встретился в
 * середине: человек печатает «пар» ради «Парка культуры», а не «Технопарка».
 */
export function searchStationsOffline(
  city: string,
  query: string,
  limit = 8,
): MetroStation[] {
  const q = stationKey(query);
  if (!q) return [];
  const starts: MetroStation[] = [];
  const inside: MetroStation[] = [];
  for (const s of cityStations(city)) {
    const key = stationKey(s.name);
    if (key.startsWith(q)) starts.push(s);
    else if (key.includes(q)) inside.push(s);
    if (starts.length >= limit) break;
  }
  return [...starts, ...inside].slice(0, limit);
}

export function findStationOffline(
  city: string,
  name: string,
): MetroStation | undefined {
  const key = stationKey(name);
  return cityStations(city).find((s) => stationKey(s.name) === key);
}

/**
 * Что действительно сохраняем из поля метро. Сначала свой справочник — он
 * бесплатный и закрывает все города РФ с метро; чего там нет, спрашиваем у
 * DaData. Если DaData недоступна, сохраняем как ввели: потерять станции
 * работника из-за чужого сбоя хуже, чем пустить неидеальное написание.
 */
export async function resolveStations(
  city: string,
  raw: string,
): Promise<string[]> {
  const candidates = sanitizeMetroInput(raw).slice(0, MAX_METRO_STATIONS);
  if (candidates.length === 0) return [];

  const resolved: string[] = [];
  for (const name of candidates) {
    const offline = findStationOffline(city, name);
    if (offline) {
      resolved.push(offline.name);
      continue;
    }
    if (!hasDadataKey()) {
      resolved.push(name);
      continue;
    }
    const suggestions = await suggestMetro(city, name, 5);
    if (suggestions === null) {
      resolved.push(name);
      continue;
    }
    const exact = suggestions.find((s) => stationKey(s.name) === stationKey(name));
    if (exact) resolved.push(exact.name);
  }
  return resolved;
}
