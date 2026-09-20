-- Поле «Когда свободен» убрано: работник сам откликается на удобные смены,
-- отдельная заметка о доступности ничего не решала.
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkerProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "about" TEXT,
    "address" TEXT,
    "minPayment" INTEGER,
    "isLookingForWork" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WorkerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkerProfile" ("about", "address", "isLookingForWork", "minPayment", "userId") SELECT "about", "address", "isLookingForWork", "minPayment", "userId" FROM "WorkerProfile";
DROP TABLE "WorkerProfile";
ALTER TABLE "new_WorkerProfile" RENAME TO "WorkerProfile";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
