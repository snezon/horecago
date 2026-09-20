import { isMedBookExpired } from "@/lib/domain/med-book";
import { sanitizeMetroInput, stationKey } from "@/lib/domain/metro-input";

export type CriterionKey =
  | "city"
  | "metro"
  | "medBook"
  | "workPermit"
  | "payment";

export const CRITERIA_LABELS: Record<CriterionKey, string> = {
  city: "город",
  metro: "метро",
  medBook: "медкнижка",
  workPermit: "разрешение на работу",
  payment: "ставка",
};

export interface ShiftRequirements {
  city: string | null;
  metro: string | null;
  requireMedBook: boolean;
  requireWorkPermit: boolean;
  payment: number;
  shiftStart: Date;
}

export interface WorkerMatchProfile {
  city: string | null;
  metro: string | null;
  hasMedBook: boolean;
  medBookExpiresAt: Date | null;
  hasWorkPermit: boolean;
  minPayment: number | null;
}

export interface MatchResult {
  matched: CriterionKey[];
  failed: CriterionKey[];
  fits: boolean;
}

function sameCity(a: string | null, b: string | null): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function stationsOverlap(shiftMetro: string, workerMetro: string): boolean {
  const wanted = new Set(sanitizeMetroInput(shiftMetro).map(stationKey));
  return sanitizeMetroInput(workerMetro).some((s) => wanted.has(stationKey(s)));
}

/**
 * Насколько работник отвечает условиям смены. Условие, которого заказчик не
 * задал, не учитывается вовсе — иначе смена без требований считалась бы
 * «совпавшей на ноль из пяти» и порядок отбора терял смысл.
 *
 * Оплата — условие всегда: деньги на смене есть всегда, а работник, у которого
 * нижняя граница выше, автоматически нанят быть не должен.
 */
export function matchShift(
  shift: ShiftRequirements,
  worker: WorkerMatchProfile,
): MatchResult {
  const matched: CriterionKey[] = [];
  const failed: CriterionKey[] = [];
  const check = (key: CriterionKey, ok: boolean) =>
    (ok ? matched : failed).push(key);

  if (shift.city?.trim()) check("city", sameCity(shift.city, worker.city));

  if (shift.metro?.trim()) {
    check("metro", stationsOverlap(shift.metro, worker.metro ?? ""));
  }

  if (shift.requireMedBook) {
    check(
      "medBook",
      worker.hasMedBook &&
        !isMedBookExpired(worker.medBookExpiresAt, shift.shiftStart),
    );
  }

  if (shift.requireWorkPermit) check("workPermit", worker.hasWorkPermit);

  check("payment", worker.minPayment == null || worker.minPayment <= shift.payment);

  return { matched, failed, fits: failed.length === 0 };
}
