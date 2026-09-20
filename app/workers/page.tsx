import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Wallet } from "lucide-react";
import { AccessBadges } from "@/app/_components/AccessBadges";
import { locationLine } from "@/lib/domain/location";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/datetime";
import { representingAgencies } from "@/lib/domain/representation";
import { agencyLabel } from "@/lib/agency-label";
import { WorkerFiltersForm, positionHref } from "@/app/_components/WorkerFilters";
import { MatchBadge } from "@/app/_components/MatchBadge";
import { Pager } from "@/app/_components/Pager";
import {
  filtersFromParams,
  workerFilterWhere,
  type WorkerFilters,
} from "@/lib/domain/worker-filter";
import { busyWorkerIds } from "@/lib/domain/availability";
import { matchShift } from "@/lib/domain/matching";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;


/** Условия смены одной строкой — что именно подставилось в подбор. */
function requirementsSummary(shift: {
  city: string | null;
  metro: string | null;
  requireMedBook: boolean;
  requireWorkPermit: boolean;
  payment: number;
}): string {
  const parts: string[] = [];
  if (shift.city?.trim()) parts.push(shift.city.trim());
  if (shift.metro?.trim()) parts.push(`метро ${shift.metro.trim()}`);
  if (shift.requireMedBook) parts.push("медкнижка");
  if (shift.requireWorkPermit) parts.push("разрешение на работу");
  parts.push(`ставка до ${shift.payment} ₽`);
  return parts.join(", ");
}


/** Сколько условий смены выполняет кандидат — по нему же сортируется подбор. */
function matchedCount(
  shift: Parameters<typeof matchShift>[0],
  worker: { workerProfile: Parameters<typeof matchShift>[1] | null },
): number {
  if (!worker.workerProfile) return 0;
  return matchShift(shift, worker.workerProfile).matched.length;
}

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: {
    position?: string;
    city?: string;
    metro?: string;
    med?: string;
    permit?: string;
    shift?: string;
    edited?: string;
    page?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");

  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });

  // Подбор под смену: условия берём из неё самой, чтобы заказчику не
  // переписывать их руками — и медкнижку проверяем на дату смены, а не на
  // сегодня.
  const shift = searchParams.shift
    ? await prisma.shift.findFirst({
        where: { id: searchParams.shift, hrId: user.id },
        include: { position: true },
      })
    : null;

  const filter = shift
    ? shift.positionId
    : searchParams.position
      ? Number(searchParams.position)
      : null;

  // Условия смены — только начальное значение отбора: заказчик может поправить
  // их прямо здесь, и тогда мы берём то, что он ввёл (метка edited), а не то,
  // что записано в смене.
  const edited = searchParams.edited === "1";
  const filters: WorkerFilters =
    shift && !edited
      ? {
          city: shift.city,
          metro: shift.metro,
          medBook: shift.requireMedBook,
          workPermit: shift.requireWorkPermit,
          maxPayment: shift.payment,
        }
      : {
          ...filtersFromParams(searchParams),
          maxPayment: shift ? shift.payment : null,
        };
  const matchOn = shift ? shift.shiftStart : new Date();

  // Занятые на пересекающейся смене в подбор не попадают: звать человека,
  // который в это время уже работает, — потерянное время обеих сторон.
  const busy = shift
    ? await busyWorkerIds(shift.shiftStart, shift.shiftEnd, shift.id)
    : new Set<string>();

  const where = {
    role: "WORKER",
    ...(busy.size > 0 ? { id: { notIn: [...busy] } } : {}),
    workerProfile: {
      isLookingForWork: true,
      ...(filter ? { skills: { some: { positionId: filter } } } : {}),
      ...workerFilterWhere(filters, matchOn),
    },
  };

  const page = Math.max(1, Number(searchParams.page) || 1);
  const total = await prisma.user.count({ where });

  const found = await prisma.user.findMany({
    where,
    include: {
      workerProfile: {
        include: {
          skills: { include: { position: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // В подборе под смену порядок тот же, каким его видит авто-найм: сначала
  // те, у кого совпало больше условий. Иначе экран и автоматика показывали бы
  // заказчику разных «лучших».
  const workers = shift
    ? [...found].sort(
        (a, b) =>
          matchedCount(shift, b) - matchedCount(shift, a) ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      )
    : found;


  const agencyMap = await representingAgencies(workers.map((w) => w.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 mb-1">Соискатели</h1>
        <p className="text-ink-500">
          {total} {plural(total, "кандидат", "кандидата", "кандидатов")} ищут смены
          {busy.size > 0 && `, ещё ${busy.size} заняты в это время`}
        </p>
      </div>

      {shift && (
        <div className="card !p-4 text-sm text-ink-700">
          Подбор под смену «{shift.title}» ({shift.position.name}).{" "}
          {edited
            ? "Отбор изменён вручную."
            : `Условия смены подставлены: ${requirementsSummary(shift) || "особых нет"}.`}{" "}
          <Link href={`/workers?shift=${shift.id}`} className="underline text-ink-900">
            Вернуть условия смены
          </Link>
          {" · "}
          <Link href="/workers" className="underline text-ink-900">
            Показать всех соискателей
          </Link>
        </div>
      )}

      <WorkerFiltersForm
        action="/workers"
        filters={filters}
        hidden={{
          position: searchParams.position,
          shift: searchParams.shift,
          edited: shift ? "1" : undefined,
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Link href={positionHref("/workers", null, searchParams)} className={!filter ? "chip-active" : "chip-default"}>Все</Link>
        {positions.map((p) => (
          <Link key={p.id} href={positionHref("/workers", p.id, searchParams)} className={filter === p.id ? "chip-active" : "chip-default"}>
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
            const agencies = agencyMap.get(w.id) ?? [];
            return (
              <li key={w.id}>
                <Link href={`/worker/${w.id}`} className="card-interactive block h-full cursor-pointer">
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

                  {shift && <MatchBadge shift={shift} profile={w.workerProfile} />}

                  <AccessBadges profile={w.workerProfile} className="mb-3" />

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

                  {agencies.length > 0 && (
                    <div className="mb-3">
                      <span className="badge-muted">{agencyLabel(agencies)}</span>
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    {w.workerProfile?.minPayment != null && (
                      <div className="flex items-center gap-2 text-ink-900 font-medium">
                        <Wallet className="w-3.5 h-3.5 text-accent-500 shrink-0" />
                        от {formatRub(w.workerProfile.minPayment)} ₽ за смену
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pager base="/workers" params={searchParams} page={page} pageSize={PAGE_SIZE} total={total} />
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
