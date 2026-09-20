import Link from "next/link";
import { pageCount, pagerHref } from "@/lib/pager";

/**
 * Постраничность списка. Показываем только «назад/вперёд» и место в списке:
 * номера страниц при отборе, который человек тут же меняет, живут недолго.
 */
export function Pager({
  base,
  params,
  page,
  pageSize,
  total,
}: {
  base: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;

  const href = (next: number) => pagerHref(base, params, next);

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn-secondary">
          Назад
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-500">
        Страница {page} из {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="btn-secondary">
          Дальше
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
