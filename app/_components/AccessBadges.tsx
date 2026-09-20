import { isMedBookExpired } from "@/lib/domain/med-book";

type AccessProfile = {
  hasMedBook: boolean;
  medBookExpiresAt: Date | null;
  hasWorkPermit: boolean;
};

/**
 * Допуск работника глазами заказчика: медкнижка и разрешение на работу.
 * Это отметки со слов самого работника — площадка их не проверяет, поэтому
 * подпись у бейджа честно об этом говорит, а просроченная медкнижка
 * показывается красной, а не исчезает: «была, но истекла» и «нет вообще» —
 * разные истории для того, кто ищет замену на смену.
 */
export function AccessBadges({
  profile,
  className = "",
}: {
  profile: AccessProfile | null | undefined;
  className?: string;
}) {
  if (!profile) return null;
  if (!profile.hasMedBook && !profile.hasWorkPermit) return null;

  const expired = isMedBookExpired(profile.medBookExpiresAt, new Date());
  const until = profile.medBookExpiresAt?.toLocaleDateString("ru-RU");

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {profile.hasMedBook && (
        <span
          className={expired ? "badge-warning" : "badge-success"}
          title="Со слов работника"
        >
          {expired
            ? `Медкнижка истекла ${until}`
            : until
              ? `Медкнижка до ${until}`
              : "Медкнижка есть"}
        </span>
      )}
      {profile.hasWorkPermit && (
        <span className="badge-neutral" title="Со слов работника">
          Разрешение на работу
        </span>
      )}
    </div>
  );
}
