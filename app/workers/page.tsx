import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Wallet, Calendar, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function WorkersPage({ searchParams }: { searchParams: { position?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");

  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });
  const filter = searchParams.position ? Number(searchParams.position) : null;

  const workers = await prisma.user.findMany({
    where: {
      role: "WORKER",
      workerProfile: {
        isLookingForWork: true,
        ...(filter
          ? { skills: { some: { positionId: filter } } }
          : {}),
      },
    },
    include: {
      workerProfile: {
        include: {
          skills: { include: { position: true } },
          documents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 mb-1">Соискатели</h1>
        <p className="text-ink-500">{workers.length} {plural(workers.length, "кандидат", "кандидата", "кандидатов")} ищут смены</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/workers" className={!filter ? "chip-active" : "chip-default"}>Все</Link>
        {positions.map((p) => (
          <Link key={p.id} href={`/workers?position=${p.id}`} className={filter === p.id ? "chip-active" : "chip-default"}>
            {p.name}
          </Link>
        ))}
      </div>

      {workers.length === 0 ? (
        <div className="card text-center text-ink-500 py-12">Подходящих соискателей нет</div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {workers.map((w) => {
            const skills = w.workerProfile?.skills.map((s) => s.position.name) ?? [];
            const docCount = w.workerProfile?.documents.length ?? 0;
            return (
              <li key={w.id}>
                <Link href={`/worker/${w.id}`} className="card-interactive block h-full cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-ink-900 text-accent-400 font-semibold shrink-0">
                      {(w.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900 truncate">{w.name ?? "Без имени"}</div>
                      {w.workerProfile?.address && (
                        <div className="flex items-center gap-1 text-xs text-ink-500">
                          <MapPin className="w-3 h-3" /> {w.workerProfile.address}
                        </div>
                      )}
                    </div>
                  </div>

                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {skills.slice(0, 4).map((s) => (
                        <span key={s} className="text-xs bg-ink-100 text-ink-700 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                      {skills.length > 4 && (
                        <span className="text-xs text-ink-500">+{skills.length - 4}</span>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    {w.workerProfile?.minPayment != null && (
                      <div className="flex items-center gap-2 text-ink-900 font-medium">
                        <Wallet className="w-3.5 h-3.5 text-accent-500 shrink-0" />
                        от {formatRub(w.workerProfile.minPayment)} ₽ за смену
                      </div>
                    )}
                    {w.workerProfile?.availabilityNote && (
                      <div className="flex items-center gap-2 text-ink-700">
                        <Calendar className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                        <span className="truncate">{w.workerProfile.availabilityNote}</span>
                      </div>
                    )}
                    {docCount > 0 && (
                      <div className="flex items-center gap-2 text-ink-500 text-xs">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        {docCount} {plural(docCount, "документ", "документа", "документов")}
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
