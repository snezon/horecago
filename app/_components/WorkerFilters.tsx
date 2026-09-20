import type { WorkerFilters } from "@/lib/domain/worker-filter";

/** Ссылка на позицию, не теряющая уже выбранные фильтры. */
export function positionHref(
  base: string,
  positionId: number | null,
  params: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const key of ["city", "metro", "med", "permit"]) {
    if (params[key]) query.set(key, params[key]!);
  }
  if (positionId) query.set("position", String(positionId));
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Фильтры соискателей обычной GET-формой: ссылку с найденным списком можно
 * переслать коллеге или сохранить, а состояние живёт в адресе, а не в памяти
 * вкладки.
 */
export function WorkerFiltersForm({
  action,
  filters,
  hidden = {},
}: {
  action: string;
  filters: WorkerFilters;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="card !p-4 flex flex-wrap items-end gap-3">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}

      <div className="flex-1 min-w-[150px]">
        <label className="label">Город</label>
        <input name="city" className="input" defaultValue={filters.city ?? ""} placeholder="Москва" />
      </div>

      <div className="flex-1 min-w-[180px]">
        <label className="label">Станции метро</label>
        <input
          name="metro"
          className="input"
          defaultValue={filters.metro ?? ""}
          placeholder="Тверская, Курская"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-700 h-10">
        <input type="checkbox" name="med" value="1" defaultChecked={filters.medBook} className="accent-ink-900" />
        Медкнижка
      </label>

      <label className="flex items-center gap-2 text-sm text-ink-700 h-10">
        <input type="checkbox" name="permit" value="1" defaultChecked={filters.workPermit} className="accent-ink-900" />
        Разрешение на работу
      </label>

      <button className="btn-secondary h-10">Показать</button>
    </form>
  );
}
