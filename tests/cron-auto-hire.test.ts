import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/cron/auto-hire/route";

afterEach(() => vi.unstubAllEnvs());

function call(secret?: string) {
  return POST(
    new NextRequest("https://horecago.tech/api/cron/auto-hire", {
      method: "POST",
      headers: secret ? { "x-cron-secret": secret } : {},
    }),
  );
}

describe("ручка планировщика", () => {
  beforeEach(() => vi.stubEnv("CRON_SECRET", "s3cret"));

  it("без секрета не пускает", async () => {
    expect((await call()).status).toBe(401);
  });

  it("с чужим секретом не пускает", async () => {
    expect((await call("wrong")).status).toBe(401);
  });

  it("с правильным секретом отрабатывает", async () => {
    const res = await call("s3cret");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ shifts: 0, hired: [] });
  });

  it("без заданного CRON_SECRET выключена совсем", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("s3cret")).status).toBe(503);
  });
});
