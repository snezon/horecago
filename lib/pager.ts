/** Сколько страниц нужно для такого количества записей. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Адрес страницы списка. Первая страница живёт без параметра `page`, чтобы
 * ссылка на список выглядела одинаково, с какой бы стороны в него ни пришли.
 */
export function pagerHref(
  base: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}
