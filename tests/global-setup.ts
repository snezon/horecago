import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export default function setup() {
  const dir = path.resolve(__dirname, ".tmp");
  fs.mkdirSync(dir, { recursive: true });
  const url = `file:${path.join(dir, "test.db")}`;

  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
