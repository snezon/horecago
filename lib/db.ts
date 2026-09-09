import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  walEnabled?: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite по умолчанию блокирует базу целиком на запись.
// WAL позволяет читать во время записи — при нескольких агентствах это обязательно.
if (!globalForPrisma.walEnabled) {
  globalForPrisma.walEnabled = true;
  prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch((e) => {
    console.error("Не удалось включить WAL:", e);
  });
  // При конкурентной записи (условные updateMany в найме) SQLite может быть
  // занят долю секунды — ждём вместо мгновенной ошибки SQLITE_BUSY.
  prisma.$executeRawUnsafe("PRAGMA busy_timeout=5000;").catch((e) => {
    console.error("Не удалось задать busy_timeout:", e);
  });
}
