import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function HRDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");
  if (!user.hrProfile) redirect("/onboarding/hr");

  const vacancies = await prisma.vacancy.findMany({
    where: { hrId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      position: true,
      _count: { select: { applications: { where: { status: "PENDING" } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{user.hrProfile.hotelName}</h1>
          <p className="text-sm text-gray-600">{user.hrProfile.address}</p>
        </div>
        <Link href="/hr/vacancies/new" className="btn-primary">+ Вакансия</Link>
      </div>

      {vacancies.length === 0 ? (
        <div className="card text-center text-gray-500">
          Пока нет вакансий. Создайте первую.
        </div>
      ) : (
        <ul className="space-y-3">
          {vacancies.map((v) => (
            <li key={v.id}>
              <Link href={`/hr/vacancies/${v.id}`} className="card hover:border-brand-500 block">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{v.title}</span>
                      {v.status === "CLOSED" && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">Закрыта</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {v.position.name} · {v.address}
                    </div>
                    {v.salary && <div className="text-sm text-gray-700 mt-1">{v.salary}</div>}
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{v.hiredCount} / {v.headcount}</div>
                    <div className="text-gray-500">нанято</div>
                    {v._count.applications > 0 && (
                      <div className="mt-1 text-brand-700 font-medium">+{v._count.applications} новых</div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
