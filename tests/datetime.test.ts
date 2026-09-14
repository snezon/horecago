import { describe, it, expect } from "vitest";
import { parseLocalDateInput } from "@/lib/datetime";

describe("parseLocalDateInput", () => {
  it("разбирает 'ГГГГ-ММ-ДД' как локальную полночь — год/месяц/день совпадают при чтении локальными методами", () => {
    const d = parseLocalDateInput("2027-03-12");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2027);
    expect(d!.getMonth()).toBe(2); // 0-based: март
    expect(d!.getDate()).toBe(12);
  });

  it("не зависит от часового пояса — не сдвигается на соседние сутки", () => {
    const d = parseLocalDateInput("2026-01-01")!;
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
  });

  it("пустая строка — null", () => {
    expect(parseLocalDateInput("")).toBeNull();
  });

  it("некорректный формат — null", () => {
    expect(parseLocalDateInput("12.03.2027")).toBeNull();
    expect(parseLocalDateInput("2027-3-12")).toBeNull();
    expect(parseLocalDateInput("not-a-date")).toBeNull();
  });

  it("несуществующая календарная дата — null", () => {
    expect(parseLocalDateInput("2026-02-30")).toBeNull();
  });
});
