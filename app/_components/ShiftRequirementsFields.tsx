import { LocationFields } from "./LocationFields";
import { METRO_CITIES } from "@/lib/domain/metro";
import { AUTO_HIRE_WINDOWS } from "@/lib/domain/auto-hire";

const WINDOW_LABELS: Record<number, string> = {
  60: "через час после публикации",
  180: "через 3 часа после публикации",
  720: "через 12 часов после публикации",
};

interface Values {
  city?: string | null;
  metro?: string | null;
  requireMedBook?: boolean;
  requireWorkPermit?: boolean;
  autoHire?: boolean;
  autoHireWindowMin?: number;
}

/**
 * Условия смены и авто-найм — один блок формы: галочка «нанимать
 * автоматически» без условий бессмысленна, а условия без неё всё равно
 * нужны заказчику, чтобы видеть, кто из откликнувшихся подходит.
 */
export function ShiftRequirementsFields({ values = {} }: { values?: Values }) {
  return (
    <div className="rounded-xl border border-ink-200 p-4 space-y-4">
      <div className="text-sm font-semibold text-ink-900">Кого ищем</div>

      <LocationFields
        defaultCity={values.city ?? ""}
        defaultMetro={values.metro ?? ""}
        metroCities={METRO_CITIES}
        metroLabel="Станции метро рядом со сменой"
        metroHint="Подойдут соискатели, у которых в профиле есть хотя бы одна из этих станций"
      />

      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="requireMedBook"
          value="1"
          defaultChecked={values.requireMedBook ?? false}
          className="accent-ink-900 mt-0.5"
        />
        <span>Нужна действующая медкнижка</span>
      </label>

      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="requireWorkPermit"
          value="1"
          defaultChecked={values.requireWorkPermit ?? false}
          className="accent-ink-900 mt-0.5"
        />
        <span>Нужно разрешение на работу в РФ</span>
      </label>

      <div className="border-t border-ink-200/70 pt-4 space-y-3">
        <label className="flex items-start gap-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="autoHire"
            value="1"
            defaultChecked={values.autoHire ?? false}
            className="accent-ink-900 mt-0.5"
          />
          <span className="font-medium text-ink-900">Нанимать автоматически</span>
        </label>
        <p className="text-xs text-ink-500">
          Собираем отклики, затем занимаем все места теми, кто отвечает условиям:
          сначала те, у кого совпало больше, при равенстве — кто откликнулся
          раньше. Решение принимается не позже чем за 2 часа до начала смены.
          Найм можно снять вручную.
        </p>
        <div className="sm:max-w-[320px]">
          <label className="label">Когда решать</label>
          <select
            name="autoHireWindowMin"
            className="input"
            defaultValue={String(values.autoHireWindowMin ?? 180)}
          >
            {AUTO_HIRE_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {WINDOW_LABELS[w]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
