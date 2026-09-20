-- Условия смены и авто-найм.
ALTER TABLE "Shift" ADD COLUMN "city" TEXT;
ALTER TABLE "Shift" ADD COLUMN "metro" TEXT;
ALTER TABLE "Shift" ADD COLUMN "requireMedBook" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shift" ADD COLUMN "requireWorkPermit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shift" ADD COLUMN "autoHire" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shift" ADD COLUMN "autoHireWindowMin" INTEGER NOT NULL DEFAULT 180;
ALTER TABLE "Shift" ADD COLUMN "autoHireDecideAt" DATETIME;
ALTER TABLE "Shift" ADD COLUMN "autoHireDoneAt" DATETIME;
CREATE INDEX "Shift_autoHire_autoHireDoneAt_autoHireDecideAt_idx" ON "Shift"("autoHire", "autoHireDoneAt", "autoHireDecideAt");
