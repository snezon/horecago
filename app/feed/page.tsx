import Link from "next/link";
import { MapPin, Users, Wallet, Building2 } from "lucide-react";
import { prisma } from "@/lib/db";

export default async function FeedPage({ searchParams }: { searchParams: { position?: string } }) {
  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });
  const filter = searchParams.position ? Number(searchParams.position) : null;

  const vacancies = await prisma.vacancy.findMany({
    where: {
      status: "OPEN",
      ...(filter ? { positionId: filter } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { position: true, hr: { include: { hrProfile: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 mb-1">Открытые вакансии</h1>
        <p className="text-ink-500">{vacancies.length} {plural(vacancies.length, "вакансия", "вакансии", "вакансий")} в HoReCa</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/feed" className={!filter ? "chip-active" : "chip-default"}>
          Все
        </Link>
        {positions.map((p) => (
          <Link
            key={p.id}
            href={`/feed?position=${p.id}`}
            className={filter === p.id ? "chip-active" : "chip-default"}
          >
            {p.name}
          </Link>
        ))}
      </div>

      {vacancies.length === 0 ? (
        <div className="card text-center text-ink-500 py-12">
          По выбранному фильтру пока нет открытых вакансий
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {vacancies.map((v) => {
            const slotsLeft = v.headcount - v.hiredCount;
            return (
              <li key={v.id}>
                <Link href={`/vacancy/${v.id}`} className="card-interactive block h-full">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="badge-neutral">{v.position.name}</span>
                    <span className="badge-warning">
                      <Users className="w-3 h-3" /> {slotsLeft} {plural(slotsLeft, "место", "места", "мест")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg text-ink-900 leading-snug mb-3">{v.title}</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-ink-700">
                      <Building2 className="w-4 h-4 text-ink-400 shrink-0" />
                      {v.hr.hrProfile?.hotelName}
                    </div>
                    <div className="flex items-center gap-2 text-ink-500">
                      <MapPin className="w-4 h-4 text-ink-400 shrink-0" />
                      {v.address}
                    </div>
                    {v.salary && (
                      <div className="flex items-center gap-2 text-ink-900 font-medium">
                        <Wallet className="w-4 h-4 text-accent-500 shrink-0" />
                        {v.salary}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
