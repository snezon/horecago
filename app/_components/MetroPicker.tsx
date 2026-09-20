"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  MAX_METRO_STATIONS,
  findStation,
  formatMetroSelection,
  parseMetroSelection,
  searchStations,
  stationKey,
} from "@/lib/domain/metro";

/**
 * Выбор станций метро из справочника (Москва, api.hh.ru). Сами станции
 * уезжают на сервер обычной строкой в скрытом поле — форма остаётся простой
 * серверной формой, а сервер всё равно перепроверяет выбор по справочнику.
 */
export function MetroPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    parseMetroSelection(defaultValue),
  );
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const chosen = new Set(selected.map(stationKey));
    return searchStations(query).filter((s) => !chosen.has(stationKey(s.name)));
  }, [query, selected]);

  const full = selected.length >= MAX_METRO_STATIONS;

  function add(stationName: string) {
    const station = findStation(stationName);
    if (!station || full) return;
    if (selected.some((s) => stationKey(s) === stationKey(station.name))) return;
    setSelected([...selected, station.name]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(stationName: string) {
    setSelected(selected.filter((s) => s !== stationName));
  }

  return (
    <div>
      <input type="hidden" name={name} value={formatMetroSelection(selected)} />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((s) => {
            const station = findStation(s);
            return (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 text-sm bg-ink-100 text-ink-800 pl-2 pr-1 py-1 rounded-full"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: station?.color ?? "#94a3b8" }}
                  aria-hidden
                />
                {s}
                <button
                  type="button"
                  onClick={() => remove(s)}
                  className="p-0.5 rounded-full hover:bg-ink-200 text-ink-500"
                  aria-label={`Убрать ${s}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="input"
          value={query}
          disabled={full}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Форма не должна улетать на сервер от Enter в поиске станции.
              e.preventDefault();
              if (suggestions[0]) add(suggestions[0].name);
            }
          }}
          placeholder={full ? "Достаточно станций" : "Начните вводить: Тверская"}
          autoComplete="off"
        />

        {suggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <li key={`${s.name}-${s.line}`}>
                <button
                  type="button"
                  onClick={() => add(s.name)}
                  className="w-full text-left px-3 py-2 hover:bg-ink-50 flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="text-sm text-ink-900">{s.name}</span>
                  <span className="text-xs text-ink-500 ml-auto">{s.line}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-500 mt-1">
        До {MAX_METRO_STATIONS} станций. Заказчик увидит их в вашем отклике.
      </p>
    </div>
  );
}
