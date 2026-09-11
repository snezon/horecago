import { describe, it, expect } from "vitest";
import { prisma } from "../helpers/db";

/**
 * Регрессия: раньше директивы применялись через $executeRawUnsafe и молча падали
 * с «Execute returned results», из-за чего busy_timeout оставался нулевым,
 * а защита от одновременной записи не работала.
 */
describe("настройки соединения с базой", () => {
  it("режим журнала — WAL", async () => {
    const rows = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>(
      "PRAGMA journal_mode;",
    );
    expect(rows[0].journal_mode.toLowerCase()).toBe("wal");
  });

  it("ожидание при занятой базе задано, а не ноль", async () => {
    const rows = await prisma.$queryRawUnsafe<{ timeout: number }[]>(
      "PRAGMA busy_timeout;",
    );
    expect(Number(rows[0].timeout)).toBeGreaterThan(0);
  });
});
