"use client";

import { useEffect, useRef, useState } from "react";
import { MetroPicker } from "./MetroPicker";

/**
 * Город и станции метро одним блоком: станции зависят от выбранного города,
 * поэтому город живёт в состоянии, а не просто в поле. Подсказка города —
 * DaData через нашу ручку; ввести город руками тоже можно, в стране больше
 * тысячи населённых пунктов и справочник всегда чуть отстаёт.
 */
export function LocationFields({
  defaultCity,
  defaultMetro,
  metroCities,
}: {
  defaultCity: string;
  defaultMetro: string;
  metroCities: string[];
}) {
  const [city, setCity] = useState(defaultCity);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const hasMetro = metroCities.some(
    (c) => c.toLowerCase() === city.trim().toLowerCase(),
  );

  useEffect(() => {
    const q = city.trim();
    if (!open || !q) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest/city?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { cities?: string[] };
        setSuggestions((data.cities ?? []).filter((c) => c !== q));
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [city, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <>
      <div ref={boxRef}>
        <label className="label">Город</label>
        <div className="relative">
          <input
            name="city"
            className="input"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions[0]) {
                  setCity(suggestions[0]);
                  setOpen(false);
                }
              }
            }}
            placeholder="Москва"
            autoComplete="off"
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-ink-900 hover:bg-ink-50"
                    onClick={() => {
                      setCity(c);
                      setOpen(false);
                    }}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {hasMetro ? (
        <div>
          <label className="label">Укажите станции метро, удобные для работы</label>
          <MetroPicker name="metro" defaultValue={defaultMetro} city={city} />
        </div>
      ) : (
        // Станции без города не спрашиваем: в городе без метро поле бессмысленно,
        // а прежний выбор сохраняем скрытым — вдруг город указали по ошибке.
        <input type="hidden" name="metro" value={defaultMetro} />
      )}
    </>
  );
}
