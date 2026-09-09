-- AlterTable
ALTER TABLE "MagicLink" ADD COLUMN "agencyId" TEXT;

-- CreateTable
CREATE TABLE "Representation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "Representation_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Representation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Representation_agencyId_status_idx" ON "Representation"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Representation_workerId_agencyId_key" ON "Representation"("workerId", "agencyId");
