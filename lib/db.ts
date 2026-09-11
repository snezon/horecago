import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pragmasApplied?: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Обе директивы возвращают значение, поэтому применяются через $queryRawUnsafe:
 * $executeRawUnsafe отказывается выполнять запросы с результатом
 * («Execute returned results, which is not allowed in SQLite»).
 *
 * journal_mode пишется в сам файл базы и переживает перезапуск,
 * а busy_timeout — настройка соединения и задаётся заново каждый раз.
 */
if (!globalForPrisma.pragmasApplied) {
  globalForPrisma.pragmasApplied = true;
  // SQLite по умолчанию блокирует базу целиком на запись.
  // WAL позволяет читать во время записи — при нескольких агентствах это обязательно.
  prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch((e) => {
    console.error("Не удалось включить WAL:", e);
  });
  // При конкурентной записи (условные updateMany в найме) база может быть занята
  // долю секунды — ждём вместо мгновенной ошибки SQLITE_BUSY.
  prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;").catch((e) => {
    console.error("Не удалось задать busy_timeout:", e);
  });
}
