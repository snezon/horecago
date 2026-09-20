import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { suggestMetro } from "@/lib/dadata";
import { searchStationsOffline } from "@/lib/domain/metro";

/**
 * Подсказка станций для формы профиля. Ходит в DaData ключом, который лежит
 * только на сервере; вход — под сессией, чтобы посторонние не жгли нашу
 * дневную квоту. Если DaData молчит, отвечаем своим справочником.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ stations: [] }, { status: 401 });

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const city = (req.nextUrl.searchParams.get("city") ?? "").trim();
  if (!query) return NextResponse.json({ stations: [] });

  const fromDadata = await suggestMetro(city, query);
  if (fromDadata && fromDadata.length > 0) {
    return NextResponse.json({ stations: fromDadata, source: "dadata" });
  }
  // Пустой ответ DaData — это «такой станции нет», но справочник дешевле
  // перепроверить, чем оставить человека без подсказки из-за расхождения баз.
  const offline = searchStationsOffline(city, query).map((s) => ({
    name: s.name,
    line: s.line,
    color: s.color,
    city,
  }));
  return NextResponse.json({ stations: offline, source: "offline" });
}
