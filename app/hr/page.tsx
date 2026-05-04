import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users, Bell, Briefcase, MapPin, Calendar, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftLabel, formatRub } from "@/lib/datetime";

export default async function HRDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");
  if (!user.hrProfile) redirect("/onboarding/hr");

  const shifts = await prisma.shift.findMany({
    where: { hrId: user.id },
    orderBy: { shiftStart: "asc" },
    include: {
      position: true,
      _count: { select: { applications: { where: { status: "PENDING" } } } },
    },
  });

  const open = shifts.filter((s) => s.status === "OPEN").length;
  const totalHired = shifts.reduce((acc, s) => acc + s.hiredCount, 0);
  const totalPending = shifts.reduce((acc, s) => acc + s._count.applications, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Кабинет работодателя</div>
          <h1 className="text-3xl font-bold text-ink-900">{user.hrProfile.hotelName}</h1>
          <div className="flex items-center gap-1.5 text-sm text-ink-500 mt-1">
            <MapPin className="w-3.5 h-3.5" />
            {user.hrProfile.address}
          </div>
        </div>
        <Link href="/hr/shifts/new" className="btn-accent !px-5 !py-2.5">
          <Plus className="w-4 h-4" />
          Новая смена
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={<Briefcase className="w-4 h-4" />} label="Открытых смен" value={open} />
        <Stat icon={<Bell className="w-4 h-4" />} label="Новых заявок" value={totalPending} highlight={totalPending > 0} />
        <Stat icon={<Users className="w-4 h-4" />} label="Подтверждено всего" value={totalHired} />
      </div>

      <section>
        <h2 className="section-title mb-4">Смены</h2>
        {shifts.length === 0 ? (
          <div className="card text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-100 text-ink-500 mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <p className="text-ink-600 mb-4">Пока нет ни одной смены</p>
            <Link href="/hr/shifts/new" className="btn-primary">Создать первую</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {shifts.map((s) => (
              <li key={s.id}>
                <Link href={`/hr/shifts/${s.id}`} className="card-interactive block cursor-pointer">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="badge-neutral">{s.position.name}</span>
                        {s.status === "CLOSED" && <span className="badge-muted">Закрыта</span>}
                        {s._count.applications > 0 && (
                          <span className="badge-warning">
                            <Bell className="w-3 h-3" />
                            {s._count.applications} {s._count.applications === 1 ? "новая заявка" : "новых"}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-ink-900 mb-1">{s.title}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                        <span className="inline-flex items-center gap-1.5 text-ink-700">
                          <Calendar className="w-3.5 h-3.5 text-ink-400" />
                          {shiftLabel(s.shiftStart, s.shiftEnd)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-ink-700">
                          <Wallet className="w-3.5 h-3.5 text-ink-400" />
                          {formatRub(s.payment)} ₽
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-ink-900">
                        {s.hiredCount}<span className="text-ink-400 text-base font-normal"> / {s.headcount}</span>
                      </div>
                      <div className="text-xs text-ink-500">подтверждено</div>
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
