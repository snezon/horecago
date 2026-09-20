-- Поисковый слой профиля: город ключом и станции отдельными строками.
ALTER TABLE "WorkerProfile" ADD COLUMN "cityKey" TEXT;
CREATE INDEX "WorkerProfile_cityKey_idx" ON "WorkerProfile"("cityKey");

CREATE TABLE "WorkerMetro" (
    "workerId" TEXT NOT NULL,
    "stationKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    PRIMARY KEY ("workerId", "stationKey"),
    CONSTRAINT "WorkerMetro_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkerMetro_stationKey_idx" ON "WorkerMetro"("stationKey");

-- Заполняем город; станции переносит скрипт scripts/reindex-workers.ts,
-- потому что разбор строки станций живёт в коде, а не в SQL.
UPDATE "WorkerProfile" SET "cityKey" = lower(trim("city")) WHERE "city" IS NOT NULL;
