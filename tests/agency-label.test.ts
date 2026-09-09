import { describe, it, expect } from "vitest";
import { agencyLabel, representedNotice } from "@/lib/agency-label";

describe("agencyLabel", () => {
  it("одно агентство — единственное число", () => {
    expect(agencyLabel([{ id: "1", name: "Кадры" }])).toBe(
      "Представлен агентством «Кадры»",
    );
  });

  it("несколько агентств — множественное число, каждое имя в своих кавычках", () => {
    expect(
      agencyLabel([
        { id: "1", name: "Кадры" },
        { id: "2", name: "Актив" },
      ]),
    ).toBe("Представлен агентствами «Кадры», «Актив»");
  });

  it("пустой список — пустая строка", () => {
    expect(agencyLabel([])).toBe("");
  });
});

describe("representedNotice", () => {
  it("одно агентство — единственное число", () => {
    expect(representedNotice([{ id: "1", name: "Кадры" }])).toBe(
      "Работник представлен агентством «Кадры». Приглашение оформляется через агентство.",
    );
  });

  it("несколько агентств — множественное число, каждое имя в своих кавычках", () => {
    expect(
      representedNotice([
        { id: "1", name: "Кадры" },
        { id: "2", name: "Актив" },
      ]),
    ).toBe(
      "Работник представлен агентствами «Кадры», «Актив». Приглашение оформляется через агентство.",
    );
  });

  it("пустой список — пустая строка", () => {
    expect(representedNotice([])).toBe("");
  });
});
