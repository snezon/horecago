import { matchShift, CRITERIA_LABELS, type ShiftRequirements, type WorkerMatchProfile } from "@/lib/domain/matching";

/**
 * Насколько кандидат отвечает условиям смены. Показываем и то, чего не хватает:
 * «не подходит» без причины заставляет заказчика открывать профиль и сверять
 * руками — ровно ту работу, ради отмены которой условия и заводились.
 */
export function MatchBadge({
  shift,
  profile,
}: {
  shift: ShiftRequirements;
  profile: WorkerMatchProfile | null | undefined;
}) {
  if (!profile) return null;

  const hasConditions =
    Boolean(shift.city?.trim()) ||
    Boolean(shift.metro?.trim()) ||
    shift.requireMedBook ||
    shift.requireWorkPermit;
  if (!hasConditions) return null;

  const { fits, failed } = matchShift(shift, profile);

  return (
    <div className="mb-3">
      {fits ? (
        <span className="badge-success">Отвечает условиям смены</span>
      ) : (
        <span className="badge-warning">
          Не хватает: {failed.map((k) => CRITERIA_LABELS[k]).join(", ")}
        </span>
      )}
    </div>
  );
}
