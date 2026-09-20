import { describe, it, expect } from "vitest";
import { resolveMedBook, isMedBookExpired } from "@/lib/domain/med-book";

describe("resolveMedBook", () => {
  it("галочка со сроком — срок сохраняется", () => {
    const { hasMedBook, medBookExpiresAt } = resolveMedBook(true, "2027-03-12");
    expect(hasMedBook).toBe(true);
    expect(medBookExpiresAt?.getFullYear()).toBe(2027);
    expect(medBookExpiresAt?.getMonth()).toBe(2);
    expect(medBookExpiresAt?.getDate()).toBe(12);
  });

  it("галочка без срока — медкнижка есть, срок не указан", () => {
    expect(resolveMedBook(true, "")).toEqual({
      hasMedBook: true,
      medBookExpiresAt: null,
    });
  });

  it("снятая галочка обнуляет прежний срок", () => {
    expect(resolveMedBook(false, "2027-03-12")).toEqual({
      hasMedBook: false,
      medBookExpiresAt: null,
    });
  });

  it("мусор вместо даты не ломает сохранение", () => {
    expect(resolveMedBook(true, "12.03.2027")).toEqual({
      hasMedBook: true,
      medBookExpiresAt: null,
    });
  });
});

describe("isMedBookExpired", () => {
  const today = new Date(2026, 8, 20);

  it("вчерашний срок — истекла", () => {
    expect(isMedBookExpired(new Date(2026, 8, 19), today)).toBe(true);
  });

  it("сегодняшний срок — ещё действует", () => {
    expect(isMedBookExpired(new Date(2026, 8, 20), today)).toBe(false);
  });

  it("срока нет — не истекла", () => {
    expect(isMedBookExpired(null, today)).toBe(false);
  });
});
