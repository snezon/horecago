import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, MapPin, Newspaper } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "badge-warning",
  HIRED: "badge-success",
  REJECTED: "badge-muted",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "На рассмотрении",
  HIRED: "Нанят",
  REJECTED: "Отклонён",
};

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=WORKER");
  if (user.role !== "WORKER") redirect("/");

  const apps = await prisma.application.findMany({
    where: { workerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      vacancy: {
        include: { position: true, hr: { include: { hrProfile: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Мои отклики</h1>
        <p className="text-ink-500 text-sm">{apps.length} {plural(apps.length, "отклик", "отклика", "откликов")}</p>
      </div>

      {apps.length === 0 ? (
        <div className="card text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-100 text-ink-500 mb-3">
            <Newspaper className="w-6 h-6" />
          </div>
          <p className="text-ink-600 mb-4">Откликов пока нет</p>
          <Link href="/feed" className="btn-primary">Открыть ленту</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {apps.map((a) => {
            const isClosed = a.vacancy.status === "CLOSED";
            const showLabel =
              a.status === "PENDING" && isClosed ? "Вакансия закрыта" : STATUS_LABEL[a.status];
            const showClass =
              a.status === "PENDING" && isClosed ? "badge-muted" : STATUS_CLASS[a.status];
            return (
              <li key={a.id}>
                <Link href={`/vacancy/${a.vacancy.id}`} className="card-interactive block">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="badge-neutral">{a.vacancy.position.name}</span>
                      </div>
                      <h3 className="font-semibold text-ink-900 mb-1.5">{a.vacancy.title}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5 text-ink-700">
                          <Building2 className="w-3.5 h-3.5 text-ink-400" />
                          {a.vacancy.hr.hrProfile?.hotelName}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-ink-500">
                          <MapPin className="w-3.5 h-3.5 text-ink-400" />
                          {a.vacancy.address}
                        </span>
                      </div>
                    </div>
                    <span className={showClass}>{showLabel}</span>
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
