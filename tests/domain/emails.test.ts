import { describe, it, expect } from "vitest";
import { parseEmailList, MAX_INVITES_PER_BATCH } from "@/lib/domain/emails";

describe("parseEmailList", () => {
  it("разбирает адреса через перенос строки, запятую и точку с запятой", () => {
    const { emails } = parseEmailList("a@x.ru\nb@x.ru, c@x.ru; d@x.ru");
    expect(emails).toEqual(["a@x.ru", "b@x.ru", "c@x.ru", "d@x.ru"]);
  });

  it("приводит к нижнему регистру и убирает пробелы", () => {
    const { emails } = parseEmailList("  Nina@Example.COM  ");
    expect(emails).toEqual(["nina@example.com"]);
  });

  it("убирает повторы", () => {
    const { emails } = parseEmailList("a@x.ru\na@x.ru");
    expect(emails).toEqual(["a@x.ru"]);
  });

  it("отделяет непохожее на адрес", () => {
    const { emails, invalid } = parseEmailList("a@x.ru\nне-адрес\nb@x.ru");
    expect(emails).toEqual(["a@x.ru", "b@x.ru"]);
    expect(invalid).toEqual(["не-адрес"]);
  });

  it("пустая строка даёт пустые списки", () => {
    expect(parseEmailList("   ")).toEqual({ emails: [], invalid: [] });
  });

  it("ограничение пачки задано и разумно", () => {
    expect(MAX_INVITES_PER_BATCH).toBe(20);
  });
});
