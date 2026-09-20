import { parseLocalDateInput } from "@/lib/datetime";

/**
 * Медкнижка в профиле — слова работника, а не проверенный документ: галочка
 * плюс срок действия. Срок живёт только вместе с галочкой — сняли её, дата
 * обнуляется, иначе через полгода у человека без медкнижки всплывёт «действует
 * до» из прошлой версии профиля и заказчик примет решение по мусору.
 */
export function resolveMedBook(
  ticked: boolean,
  expiresRaw: string,
): { hasMedBook: boolean; medBookExpiresAt: Date | null } {
  if (!ticked) return { hasMedBook: false, medBookExpiresAt: null };
  return { hasMedBook: true, medBookExpiresAt: parseLocalDateInput(expiresRaw) };
}

/** Истекла ли медкнижка к сегодняшнему дню — по календарным дням, как у документов. */
export function isMedBookExpired(
  expiresAt: Date | null | undefined,
  today: Date,
): boolean {
  if (!expiresAt) return false;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return day(expiresAt) < day(today);
}
