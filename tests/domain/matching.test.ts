import { describe, it, expect } from "vitest";
import { matchShift, CRITERIA_LABELS } from "@/lib/domain/matching";

const SHIFT_START = new Date(2026, 9, 1, 9, 0);

const shift = {
  city: "Москва",
  metro: "Тверская, Пушкинская",
  requireMedBook: true,
  requireWorkPermit: false,
  payment: 4000,
  shiftStart: SHIFT_START,
};

const worker = {
  city: "Москва",
  metro: "Пушкинская, Курская",
  hasMedBook: true,
  medBookExpiresAt: new Date(2027, 0, 1),
  hasWorkPermit: false,
  minPayment: 3500,
};

describe("matchShift", () => {
  it("всё совпало — кандидат подходит целиком", () => {
    const m = matchShift(shift, worker);
    expect(m.fits).toBe(true);
    expect(m.failed).toEqual([]);
    expect(m.matched).toEqual(["city", "metro", "medBook", "payment"]);
  });

  it("другой город — не подходит", () => {
    const m = matchShift(shift, { ...worker, city: "Казань" });
    expect(m.fits).toBe(false);
    expect(m.failed).toContain("city");
  });

  it("ни одна станция не совпала — не подходит", () => {
    const m = matchShift(shift, { ...worker, metro: "Отрадное" });
    expect(m.failed).toContain("metro");
  });

  it("хватает одной общей станции", () => {
    expect(matchShift(shift, { ...worker, metro: "Тверская" }).fits).toBe(true);
  });

  it("работник без станций не проходит условие по метро", () => {
    expect(matchShift(shift, { ...worker, metro: "" }).failed).toContain("metro");
  });

  it("медкнижка, истекающая до смены, не годится", () => {
    const m = matchShift(shift, {
      ...worker,
      medBookExpiresAt: new Date(2026, 8, 30),
    });
    expect(m.failed).toContain("medBook");
  });

  it("медкнижка, истекающая в день смены, ещё годится", () => {
    const m = matchShift(shift, { ...worker, medBookExpiresAt: SHIFT_START });
    expect(m.fits).toBe(true);
  });

  it("медкнижка без срока годится, если заказчик просто требует её наличие", () => {
    const m = matchShift(shift, { ...worker, medBookExpiresAt: null });
    expect(m.fits).toBe(true);
  });

  it("разрешение на работу проверяется, только когда его требуют", () => {
    expect(matchShift(shift, { ...worker, hasWorkPermit: false }).fits).toBe(true);
    const strict = { ...shift, requireWorkPermit: true };
    expect(matchShift(strict, worker).failed).toContain("workPermit");
    expect(
      matchShift(strict, { ...worker, hasWorkPermit: true }).fits,
    ).toBe(true);
  });

  it("ставка работника выше оплаты смены — не подходит", () => {
    const m = matchShift(shift, { ...worker, minPayment: 6000 });
    expect(m.failed).toContain("payment");
  });

  it("ставка не указана — условие по деньгам считается выполненным", () => {
    expect(matchShift(shift, { ...worker, minPayment: null }).fits).toBe(true);
  });

  it("незаданные условия не считаются ни совпавшими, ни проваленными", () => {
    const loose = {
      city: null,
      metro: null,
      requireMedBook: false,
      requireWorkPermit: false,
      payment: 4000,
      shiftStart: SHIFT_START,
    };
    const m = matchShift(loose, { ...worker, city: "Казань", metro: "" });
    expect(m.matched).toEqual(["payment"]);
    expect(m.failed).toEqual([]);
    expect(m.fits).toBe(true);
  });

  it("город и станции сравниваются без оглядки на регистр и приставку «м.»", () => {
    const m = matchShift(shift, {
      ...worker,
      city: "москва",
      metro: "м. тверская",
    });
    expect(m.fits).toBe(true);
  });

  it("у каждого условия есть русское название для показа заказчику", () => {
    for (const key of ["city", "metro", "medBook", "workPermit", "payment"] as const) {
      expect(CRITERIA_LABELS[key]).toBeTruthy();
    }
  });
});
