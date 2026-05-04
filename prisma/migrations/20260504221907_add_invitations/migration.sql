-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "initiator" TEXT NOT NULL DEFAULT 'WORKER',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Application_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("createdAt", "id", "shiftId", "status", "workerId") SELECT "createdAt", "id", "shiftId", "status", "workerId" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE UNIQUE INDEX "Application_shiftId_workerId_key" ON "Application"("shiftId", "workerId");
CREATE TABLE "new_WorkerProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "about" TEXT,
    "address" TEXT,
    "minPayment" INTEGER,
    "availabilityNote" TEXT,
    "isLookingForWork" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WorkerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkerProfile" ("about", "address", "userId") SELECT "about", "address", "userId" FROM "WorkerProfile";
DROP TABLE "WorkerProfile";
ALTER TABLE "new_WorkerProfile" RENAME TO "WorkerProfile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
