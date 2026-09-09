-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Representation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "Representation_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Representation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Representation" ("activatedAt", "agencyId", "createdAt", "id", "revokedAt", "status", "workerId") SELECT "activatedAt", "agencyId", "createdAt", "id", "revokedAt", "status", "workerId" FROM "Representation";
DROP TABLE "Representation";
ALTER TABLE "new_Representation" RENAME TO "Representation";
CREATE INDEX "Representation_agencyId_status_idx" ON "Representation"("agencyId", "status");
CREATE UNIQUE INDEX "Representation_workerId_agencyId_key" ON "Representation"("workerId", "agencyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
