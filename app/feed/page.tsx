import Link from "next/link";
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Открытые вакансии</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/feed"
          className={`px-3 py-1 rounded-full border ${!filter ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-300"}`}
        >
          Все
        </Link>
        {positions.map((p) => (
          <Link
            key={p.id}
            href={`/feed?position=${p.id}`}
            className={`px-3 py-1 rounded-full border ${filter === p.id ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-300 hover:border-brand-400"}`}
          >
            {p.name}
          </Link>
        ))}
      </div>

      {vacancies.length === 0 ? (
        <div className="card text-center text-gray-500">Вакансий пока нет</div>
      ) : (
        <ul className="space-y-3">
          {vacancies.map((v) => {
            const slotsLeft = v.headcount - v.hiredCount;
            return (
              <li key={v.id}>
                <Link href={`/vacancy/${v.id}`} className="card block hover:border-brand-500">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{v.title}</div>
                      <div className="text-sm text-gray-600">
                        {v.position.name} · {v.hr.hrProfile?.hotelName}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{v.address}</div>
                      {v.salary && <div className="text-sm text-gray-700 mt-1 font-medium">{v.salary}</div>}
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium text-brand-700">{slotsLeft} мест</div>
                    </div>
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
