import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { suggestCity } from "@/lib/dadata";
import { searchCities } from "@/lib/data/cities-ru";

/** Подсказка города: DaData, а при её молчании — свой список городов РФ. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ cities: [] }, { status: 401 });

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const fromDadata = query ? await suggestCity(query) : null;
  if (fromDadata && fromDadata.length > 0) {
    return NextResponse.json({ cities: fromDadata, source: "dadata" });
  }
  return NextResponse.json({ cities: searchCities(query, 10), source: "offline" });
}
