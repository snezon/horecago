/**
 * Клиент DaData: подсказки станций метро и городов.
 *
 * Ключ живёт только на сервере — в браузер он не уезжает, формы ходят через
 * наши ручки /api/suggest/*. Без ключа и при любой сетевой беде функции
 * возвращают null: вызывающий код переходит на свой офлайн-справочник, а не
 * роняет форму.
 */

const METRO_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/metro";
const ADDRESS_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";
const TIMEOUT_MS = 3000;

export interface MetroSuggestion {
  name: string;
  line: string;
  color: string;
  city: string;
}

export function hasDadataKey(): boolean {
  return Boolean(process.env.DADATA_API_KEY);
}

async function ask(url: string, body: unknown): Promise<any | null> {
  const key = process.env.DADATA_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Сеть, таймаут, битый JSON — всё это повод молча уйти на свой справочник.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Цвет DaData приходит без решётки («1EBCEF»), а hex-ветки у нас с ней. */
export function parseMetroSuggestions(payload: unknown): MetroSuggestion[] {
  const list = (payload as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(list)) return [];

  const out: MetroSuggestion[] = [];
  for (const item of list) {
    const data = (item as { data?: Record<string, unknown> })?.data;
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    if (!name) continue;
    const rawColor = typeof data?.color === "string" ? data.color.trim() : "";
    out.push({
      name,
      line: typeof data?.line_name === "string" ? data.line_name : "",
      color: /^#?[0-9A-Fa-f]{6}$/.test(rawColor)
        ? `#${rawColor.replace(/^#/, "").toUpperCase()}`
        : "#94A3B8",
      city: typeof data?.city === "string" ? data.city : "",
    });
  }
  return out;
}

export async function suggestMetro(
  city: string,
  query: string,
  count = 8,
): Promise<MetroSuggestion[] | null> {
  const payload = await ask(METRO_URL, {
    query,
    count,
    filters: city ? [{ city }] : undefined,
  });
  return payload === null ? null : parseMetroSuggestions(payload);
}

export function parseCitySuggestions(payload: unknown): string[] {
  const list = (payload as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(list)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const data = (item as { data?: Record<string, unknown> })?.data;
    // Для посёлков DaData кладёт название в settlement, город остаётся пустым.
    const name =
      (typeof data?.city === "string" && data.city) ||
      (typeof data?.settlement === "string" && data.settlement) ||
      "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export async function suggestCity(
  query: string,
  count = 10,
): Promise<string[] | null> {
  const payload = await ask(ADDRESS_URL, {
    query,
    count,
    from_bound: { value: "city" },
    to_bound: { value: "settlement" },
    locations: [{ country: "Россия" }],
  });
  return payload === null ? null : parseCitySuggestions(payload);
}
