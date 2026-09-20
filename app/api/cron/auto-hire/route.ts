import { NextRequest, NextResponse } from "next/server";
import { runAutoHire } from "@/lib/domain/auto-hire";

/**
 * Ручка планировщика: cron на сервере дёргает её раз в несколько минут.
 * Секрет обязателен — без заданного CRON_SECRET ручка не работает вовсе,
 * иначе на проде её мог бы дёргать кто угодно.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron disabled" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const result = await runAutoHire(new Date());
  return NextResponse.json(result);
}
