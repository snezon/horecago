/*
  Warnings:

  - You are about to drop the `Vacancy` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `vacancyId` on the `Application` table. All the data in the column will be lost.
  - Added the required column `shiftId` to the `Application` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Vacancy";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hrId" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payment" INTEGER NOT NULL,
    "paymentNote" TEXT,
    "shiftStart" DATETIME NOT NULL,
    "shiftEnd" DATETIME NOT NULL,
    "address" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "hiredCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_hrId_fkey" FOREIGN KEY ("hrId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shift_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Application_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("createdAt", "id", "status", "workerId") SELECT "createdAt", "id", "status", "workerId" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE UNIQUE INDEX "Application_shiftId_workerId_key" ON "Application"("shiftId", "workerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Shift_shiftStart_idx" ON "Shift"("shiftStart");

-- CreateIndex
CREATE INDEX "Shift_status_shiftStart_idx" ON "Shift"("status", "shiftStart");
