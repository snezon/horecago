import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agencyIdsOf } from "@/lib/domain/access";
import { formatRub } from "@/lib/datetime";
import { locationLine } from "@/lib/domain/location";
import { AccessBadges } from "@/app/_components/AccessBadges";
import { WorkerFiltersForm } from "@/app/_components/WorkerFilters";
import { filtersFromParams, workerFilterWhere } from "@/lib/domain/worker-filter";

export const dynamic = "force-dynamic";

const WORKERS_LIMIT = 200;

/**
 * Свои работники глазами агентства: тем же отбором, что у заказчика. Агентство
 * должно уметь ответить на вопрос заказчика «есть у вас пятеро с медкнижкой на
 * Тверской» до того, как отправит людей.
 */
export default async function AgencyWorkersPage({
  searchParams,
}: {
  searchParams: { city?: string; metro?: string; med?: string; permit?: string; position?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=AGENCY");
  if (user.role !== "AGENCY") redirect("/");

  const [agencyId] = await agencyIdsOf(user.id);
  if (!agencyId) redirect("/onboarding/agency");

  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });
  const positionId = searchParams.position ? Number(searchParams.position) : null;
  const filters = filtersFromParams(searchParams);

  const total = await prisma.representation.count({
    where: { agencyId, status: "ACTIVE" },
  });

  const reps = await prisma.representation.findMany({
    where: {
      agencyId,
      status: "ACTIVE",
      worker: {
        workerProfile: {
          ...workerFilterWhere(filters, new Date()),
          ...(positionId ? { skills: { some: { positionId } } } : {}),
        },
      },
    },
    include: {
      worker: {
        include: {
          workerProfile: { include: { skills: { include: { position: true } } } },
        },
      },
    },
    take: WORKERS_LIMIT,
  });

  const workers = reps.map((r) => r.worker);

  return (
    <div className="space-y-6">
      <Link href="/agency" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="w-4 h-4" /> В кабинет агентства
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-ink-900 mb-1">Наши работники</h1>
        <p className="text-ink-500">
          {workers.length} из {total} подходят под отбор
        </p>
      </div>

      <WorkerFiltersForm
        action="/agency/workers"
        filters={filters}
        hidden={{ position: searchParams.position }}
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/agency/workers" className={!positionId ? "chip-active" : "chip-default"}>
          Все
        </Link>
        {positions.map((p) => (
          <Link
            key={p.id}
            href={`/agency/workers?position=${p.id}`}
            className={positionId === p.id ? "chip-active" : "chip-default"}
          >
            {p.name}
          </Link>
        ))}
      </div>

      {workers.length === 0 ? (
        <div className="card text-center text-ink-500 py-12">
          {total === 0
            ? "У агентства пока нет подтверждённых работников"
            : "Под этот отбор никто не подходит"}
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {workers.map((w) => (
            <li key={w.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-ink-900 text-accent-400 font-semibold shrink-0">
                  {(w.name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-ink-900 truncate">{w.name ?? "Без имени"}</div>
                  {locationLine(w.workerProfile) && (
                    <div className="flex items-center gap-1 text-xs text-ink-500 truncate">
                      <MapPin className="w-3 h-3 shrink-0" /> {locationLine(w.workerProfile)}
                    </div>
                  )}
                </div>
              </div>

              <AccessBadges profile={w.workerProfile} className="mb-3" />

              <div className="flex flex-wrap gap-1.5 mb-3">
                {(w.workerProfile?.skills ?? []).slice(0, 4).map((s) => (
                  <span key={s.positionId} className="text-xs bg-ink-100 text-ink-700 px-2 py-0.5 rounded-full">
                    {s.position.name}
                  </span>
                ))}
              </div>

              <div className="text-sm text-ink-700 space-y-1">
                {w.workerProfile?.minPayment != null && (
                  <div className="flex items-center gap-2 text-ink-900 font-medium">
                    <Wallet className="w-3.5 h-3.5 text-accent-500 shrink-0" />
                    от {formatRub(w.workerProfile.minPayment)} ₽ за смену
                  </div>
                )}
                <div className="text-ink-500 text-xs">{w.phone ?? w.email}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
