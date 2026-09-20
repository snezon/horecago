#!/usr/bin/env node
// Генератор справочника станций метро: api.hh.ru/metro → lib/data/metro-stations.generated.ts.
// Запускается РУКАМИ, когда открывают новые станции; результат коммитится.
//
// Почему не DaData: на нашем тарифе она блок metro не отдаёт вовсе (проверено
// боевым ключом 14.08.2026 в соседнем проекте). hh.ru отдаёт бесплатно и без ключа.
//
// Почему не запрос в рантайме: форма профиля не должна зависеть от аптайма hh.ru,
// а список станций меняется несколько раз в год.
//
//   node scripts/build-metro-dict.mjs
//
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HH_URL = "https://api.hh.ru/metro";
// Пока нанимают в Москве. Новый город — одна строка здесь и пересборка файла.
const CITIES = ["Москва"];

function normalise(s) {
  return s.toLowerCase().replace(/ё/g, "е").trim();
}

function tsString(s) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function main() {
  const res = await fetch(HH_URL, {
    headers: { "User-Agent": "horecago/1.0 (snezon@gmail.com)" },
  });
  if (!res.ok) throw new Error(`hh.ru ответил ${res.status}`);
  const cities = await res.json();

  const stations = [];
  for (const cityName of CITIES) {
    const city = cities.find((c) => c.name === cityName);
    if (!city) throw new Error(`Города «${cityName}» нет в ответе hh.ru`);

    for (const line of city.lines) {
      const color = `#${String(line.hex_color).replace(/^#/, "").toUpperCase()}`;
      if (!/^#[0-9A-F]{6}$/.test(color)) {
        throw new Error(`Плохой цвет у линии ${cityName}/${line.name}: ${line.hex_color}`);
      }
      for (const st of line.stations) {
        // В данных hh.ru встречаются имена с висящим пробелом («Бутырская »).
        stations.push({
          name: String(st.name).trim(),
          line: String(line.name).trim(),
          color,
        });
      }
    }
  }

  // Пересадочные узлы: одно имя встречается на нескольких линиях
  // (Комсомольская, Китай-город). Оставляем первое вхождение.
  const seen = new Set();
  const unique = stations.filter((s) => {
    const key = normalise(s.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const generatedAt = new Date().toISOString().slice(0, 10);
  const body = unique
    .map(
      (s) =>
        `  { name: ${tsString(s.name)}, line: ${tsString(s.line)}, color: ${tsString(s.color)} },`,
    )
    .join("\n");

  const here = dirname(fileURLToPath(import.meta.url));
  await writeFile(
    join(here, "..", "lib", "data", "metro-stations.generated.ts"),
    `// СГЕНЕРИРОВАННЫЙ ФАЙЛ — не править руками.
// Источник: ${HH_URL} (${CITIES.join(", ")}), собрано ${generatedAt}.
// Пересобрать: node scripts/build-metro-dict.mjs

export interface MetroStation {
  name: string;
  /** Название ветки, как его показывает hh.ru («Замоскворецкая», «МЦК»). */
  line: string;
  /** Цвет ветки, hex с решёткой. */
  color: string;
}

export const METRO_STATIONS: MetroStation[] = [
${body}
];
`,
    "utf8",
  );

  console.log(`Готово: ${unique.length} станций (${CITIES.join(", ")})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
