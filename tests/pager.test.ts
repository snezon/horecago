import { describe, it, expect } from "vitest";
import { pageCount, pagerHref } from "@/lib/pager";

describe("pageCount", () => {
  it("считает страницы с запасом на неполную", () => {
    expect(pageCount(120, 50)).toBe(3);
    expect(pageCount(100, 50)).toBe(2);
  });

  it("пустой список — всё равно одна страница", () => {
    expect(pageCount(0, 50)).toBe(1);
  });
});

describe("pagerHref", () => {
  it("первая страница обходится без параметра", () => {
    expect(pagerHref("/workers", { city: "Москва" }, 1)).toBe("/workers?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0");
  });

  it("сохраняет отбор и меняет только страницу", () => {
    const href = pagerHref("/workers", { city: "Москва", page: "5" }, 2);
    expect(href).toContain("page=2");
    expect(href).not.toContain("page=5");
    expect(href).toContain("city=");
  });

  it("без параметров — чистый адрес", () => {
    expect(pagerHref("/workers", {}, 1)).toBe("/workers");
  });
});
