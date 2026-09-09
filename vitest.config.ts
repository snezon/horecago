import { defineConfig } from "vitest/config";
import path from "path";

const TEST_DB = path.resolve(__dirname, "tests/.tmp/test.db");
const TEST_DB_URL = `file:${TEST_DB}`;

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    // SQLite не любит параллельную запись из нескольких процессов
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DB_URL,
      SMTP_HOST: "",
      APP_URL: "http://localhost:3100",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
