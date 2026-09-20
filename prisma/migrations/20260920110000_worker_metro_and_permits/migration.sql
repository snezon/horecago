-- Адрес работника стал списком удобных станций метро: смена приходит к человеку,
-- а не человек к точке, поэтому важен не дом, а куда он готов ехать.
ALTER TABLE "WorkerProfile" RENAME COLUMN "address" TO "metro";

-- Допуск со слов работника. Площадка его не проверяет — скан живёт в Document.
ALTER TABLE "WorkerProfile" ADD COLUMN "hasMedBook" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkerProfile" ADD COLUMN "medBookExpiresAt" DATETIME;
ALTER TABLE "WorkerProfile" ADD COLUMN "hasWorkPermit" BOOLEAN NOT NULL DEFAULT false;
