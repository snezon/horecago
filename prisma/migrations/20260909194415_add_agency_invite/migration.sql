-- CreateTable
CREATE TABLE "AgencyInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agencyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'SENT',
    "deliveryError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    CONSTRAINT "AgencyInvite_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgencyInvite_email_status_idx" ON "AgencyInvite"("email", "status");

-- CreateIndex
CREATE INDEX "AgencyInvite_agencyId_createdAt_idx" ON "AgencyInvite"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyInvite_agencyId_email_key" ON "AgencyInvite"("agencyId", "email");
