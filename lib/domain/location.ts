/**
 * Где работник готов работать одной строкой: «Москва · Тверская, Курская».
 * Город без станций и станции без города — обычное дело: в половине городов
 * метро нет, а прежние профили города ещё не указали.
 */
export function locationLine(
  profile: { city?: string | null; metro?: string | null } | null | undefined,
): string {
  if (!profile) return "";
  const parts = [profile.city?.trim(), profile.metro?.trim()].filter(
    (p): p is string => Boolean(p),
  );
  return parts.join(" · ");
}
