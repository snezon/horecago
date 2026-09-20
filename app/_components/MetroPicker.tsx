"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  MAX_METRO_STATIONS,
  formatMetroSelection,
  sanitizeMetroInput,
  stationKey,
} from "@/lib/domain/metro-input";

interface Suggestion {
  name: string;
  line: string;
  color: string;
}

/**
 * Выбор станций метро. Подсказки приходят с сервера (DaData, при её молчании —
 * свой справочник), поэтому в браузер не уезжают ни ключ, ни весь список
 * станций. На сервер станции уходят обычной строкой в скрытом поле, и сервер
 * всё равно перепроверяет выбор.
 */
export function MetroPicker({
  name,
  defaultValue,
  city,
  hint,
}: {
  name: string;
  defaultValue: string;
  city: string;
  hint?: string;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    sanitizeMetroInput(defaultValue),
  );
  const [colors, setColors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = selected.length >= MAX_METRO_STATIONS;

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    // Пауза, чтобы не дёргать подсказку на каждую букву.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suggest/metro?city=${encodeURIComponent(city)}&q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { stations?: Suggestion[] };
        const chosen = new Set(selected.map(stationKey));
        setSuggestions(
          (data.stations ?? []).filter((s) => !chosen.has(stationKey(s.name))),
        );
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, city, selected]);

  function add(s: Suggestion) {
    if (full) return;
    if (selected.some((x) => stationKey(x) === stationKey(s.name))) return;
    setSelected([...selected, s.name]);
    setColors({ ...colors, [stationKey(s.name)]: s.color });
    setQuery("");
    setSuggestions([]);
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
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 text-sm bg-ink-100 text-ink-800 pl-2 pr-1 py-1 rounded-full"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: colors[stationKey(s)] ?? "#94A3B8" }}
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
          ))}
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
              if (suggestions[0]) add(suggestions[0]);
            }
          }}
          placeholder={full ? "Достаточно станций" : "Начните вводить название станции"}
          autoComplete="off"
        />

        {suggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <li key={`${s.name}-${s.line}`}>
                <button
                  type="button"
                  onClick={() => add(s)}
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
        {hint ?? `До ${MAX_METRO_STATIONS} станций. Заказчик увидит их в вашем отклике.`}
      </p>
    </div>
  );
}
