const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** "Сегодня" / "Завтра" / "Чт, 7 мая" */
export function relativeDate(d: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400_000);

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Завтра";
  if (diffDays === -1) return "Вчера";
  if (diffDays > 1 && diffDays < 7) {
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "8:00–16:00" */
export function timeRange(start: Date, end: Date): string {
  return `${pad(start.getHours())}:${pad(start.getMinutes())}–${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

/** "Завтра, 8:00–16:00" */
export function shiftLabel(start: Date, end: Date): string {
  return `${relativeDate(start)}, ${timeRange(start, end)}`;
}

/** Для <input type="datetime-local"> — возвращает "YYYY-MM-DDTHH:mm" */
export function toLocalInput(d: Date): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Форматирует ₽ "4 500" */
export function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}
