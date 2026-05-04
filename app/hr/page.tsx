import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users, Bell, Briefcase, MapPin } from "lucide-react";
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

  const open = vacancies.filter((v) => v.status === "OPEN").length;
  const totalHired = vacancies.reduce((s, v) => s + v.hiredCount, 0);
  const totalPending = vacancies.reduce((s, v) => s + v._count.applications, 0);

  return (
    <div className="space-y-8">
      {/* Hotel header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Кабинет работодателя</div>
          <h1 className="text-3xl font-bold text-ink-900">{user.hrProfile.hotelName}</h1>
          <div className="flex items-center gap-1.5 text-sm text-ink-500 mt-1">
            <MapPin className="w-3.5 h-3.5" />
            {user.hrProfile.address}
          </div>
        </div>
        <Link href="/hr/vacancies/new" className="btn-accent !px-5 !py-2.5">
          <Plus className="w-4 h-4" />
          Новая вакансия
        </Link>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={<Briefcase className="w-4 h-4" />} label="Открытых вакансий" value={open} />
        <Stat icon={<Bell className="w-4 h-4" />} label="Новых откликов" value={totalPending} highlight={totalPending > 0} />
        <Stat icon={<Users className="w-4 h-4" />} label="Нанято всего" value={totalHired} />
      </div>

      {/* Vacancies */}
      <section>
        <h2 className="section-title mb-4">Вакансии</h2>
        {vacancies.length === 0 ? (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-100 text-ink-500 mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <p className="text-ink-600 mb-4">Пока нет ни одной вакансии</p>
            <Link href="/hr/vacancies/new" className="btn-primary">Создать первую</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {vacancies.map((v) => (
              <li key={v.id}>
                <Link href={`/hr/vacancies/${v.id}`} className="card-interactive block">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="badge-neutral">{v.position.name}</span>
                        {v.status === "CLOSED" && <span className="badge-muted">Закрыта</span>}
                        {v._count.applications > 0 && (
                          <span className="badge-warning">
                            <Bell className="w-3 h-3" />
                            {v._count.applications} {v._count.applications === 1 ? "новый отклик" : "новых"}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-ink-900 mb-1">{v.title}</h3>
                      {v.salary && <div className="text-sm text-ink-700">{v.salary}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-ink-900">
                        {v.hiredCount}<span className="text-ink-400 text-base font-normal"> / {v.headcount}</span>
                      </div>
                      <div className="text-xs text-ink-500">нанято</div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card !p-5 ${highlight ? "border-accent-200 bg-accent-50/30" : ""}`}>
      <div className="flex items-center gap-2 text-ink-500 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold text-ink-900">{value}</div>
    </div>
  );
}
