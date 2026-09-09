/**
 * Тексты интерфейса для показа происхождения работника заказчику. Это не
 * бизнес-правило (см. lib/domain/representation.ts), а формулировки — живут
 * отдельно, чтобы менять их в одном месте.
 */

type Agency = { id: string; name: string };

function agencyPhrase(agencies: Agency[]): string {
  if (agencies.length === 0) return "";
  if (agencies.length === 1) return `представлен агентством «${agencies[0].name}»`;
  const names = agencies.map((a) => `«${a.name}»`).join(", ");
  return `представлен агентствами ${names}`;
}

/** Пометка происхождения для badge/подписи: «Представлен агентством «Название»». */
export function agencyLabel(agencies: Agency[]): string {
  const phrase = agencyPhrase(agencies);
  if (!phrase) return "";
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** Текст вместо формы приглашения на смену. */
export function representedNotice(agencies: Agency[]): string {
  const phrase = agencyPhrase(agencies);
  if (!phrase) return "";
  return `Работник ${phrase}. Приглашение оформляется через агентство.`;
}
