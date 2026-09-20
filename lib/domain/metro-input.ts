/**
 * Разбор поля станций без справочника — эта часть уезжает и в браузер,
 * поэтому не тянет за собой ни данные, ни ключи.
 */

/** Сколько станций работник может отметить: больше — уже «еду куда угодно». */
export const MAX_METRO_STATIONS = 10;

const MAX_NAME_LENGTH = 60;

/** Люди пишут станцию с приставкой — «м. Тверская», «метро Тверская». */
const PREFIX_RE = /^(?:м\.?|метро)\s+/;

/** Ключ сравнения: регистр и ё/е не должны мешать совпадению. */
export function stationKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .replace(PREFIX_RE, "")
    .trim();
}

/**
 * Что вообще может быть станцией: непустая строка разумной длины, без
 * повторов и не больше лимита. Совпадение со справочником проверяется
 * отдельно и на сервере — здесь только форма записи.
 */
export function sanitizeMetroInput(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(",")) {
    const name = piece.trim().replace(PREFIX_RE, "").trim();
    if (!name || name.length > MAX_NAME_LENGTH) continue;
    const key = stationKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_METRO_STATIONS) break;
  }
  return out;
}

export function formatMetroSelection(stations: string[]): string {
  return stations.join(", ");
}
