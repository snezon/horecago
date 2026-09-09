import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export default function setup() {
  const dir = path.resolve(__dirname, ".tmp");
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "test.db");
  const url = `file:${dbPath}`;

  // WAL-файлы предыдущего прогона (test.db-wal/-shm) не успевают
  // чекпоинтнуться, если процесс завершился без явного $disconnect().
  // "db push --force-reset" на таком файле падает с "database disk image
  // is malformed" — поэтому чистим файлы базы вручную перед сбросом схемы.
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }

  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
