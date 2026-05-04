import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2, Calendar, Wallet, Newspaper, CheckCircle2, X, MessageSquare,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftLabel, formatRub } from "@/lib/datetime";
import { acceptInvitation, declineInvitation } from "./actions";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "badge-warning",
  HIRED: "badge-success",
  REJECTED: "badge-muted",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "На рассмотрении",
  HIRED: "Подтверждено",
  REJECTED: "Отклонено",
};

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=WORKER");
  if (user.role !== "WORKER") redirect("/");

  const apps = await prisma.application.findMany({
    where: { workerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      shift: {
        include: { position: true, hr: { include: { hrProfile: true } } },
      },
    },
  });

  const invitations = apps.filter((a) => a.initiator === "HR");
  const myApps = apps.filter((a) => a.initiator === "WORKER");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Заявки и приглашения</h1>
        <p className="text-ink-500 text-sm">{apps.length} {plural(apps.length, "запись", "записи", "записей")}</p>
      </div>

      {/* Invitations from HR */}
      <section>
        <h2 className="section-title mb-4">
          Приглашения от работодателей{" "}
          {invitations.filter((i) => i.status === "PENDING").length > 0 && (
            <span className="ml-2 badge-warning">
              {invitations.filter((i) => i.status === "PENDING").length} новых
            </span>
          )}
        </h2>
        {invitations.length === 0 ? (
          <div className="card text-center text-sm text-ink-500 py-6">
            Приглашений пока нет
          </div>
        ) : (
          <ul className="space-y-3">
            {invitations.map((a) => <InvitationCard key={a.id} a={a} />)}
          </ul>
        )}
      </section>

      {/* My applications */}
      <section>
        <h2 className="section-title mb-4">Мои заявки</h2>
        {myApps.length === 0 ? (
          <div className="card text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-100 text-ink-500 mb-3">
              <Newspaper className="w-6 h-6" />
            </div>
            <p className="text-ink-600 mb-3 text-sm">Заявок нет</p>
            <Link href="/feed" className="btn-primary">Открыть ленту</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {myApps.map((a) => <MyAppCard key={a.id} a={a} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function InvitationCard({ a }: { a: any }) {
  const isClosed = a.shift.status === "CLOSED";
  const showLabel =
    a.status === "PENDING" && isClosed ? "Смена закрыта" : STATUS_LABEL[a.status];
  const showClass =
    a.status === "PENDING" && isClosed ? "badge-muted" : STATUS_CLASS[a.status];
  const canAct = a.status === "PENDING" && !isClosed;

  return (
    <li className="card">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="badge-neutral">{a.shift.position.name}</span>
            <span className={showClass}>{showLabel}</span>
          </div>
          <Link href={`/shift/${a.shift.id}`} className="font-semibold text-ink-900 hover:underline">
            {a.shift.title}
          </Link>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-ink-900 font-medium">
              <Calendar className="w-3.5 h-3.5 text-accent-500" />
              {shiftLabel(a.shift.shiftStart, a.shift.shiftEnd)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-900 font-medium">
              <Wallet className="w-3.5 h-3.5 text-accent-500" />
              {formatRub(a.shift.payment)} ₽
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-700">
              <Building2 className="w-3.5 h-3.5 text-ink-400" />
              {a.shift.hr.hrProfile?.hotelName}
            </span>
          </div>
        </div>
      </div>

      {a.message && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-ink-50 text-sm text-ink-700 mb-3">
          <MessageSquare className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
          {a.message}
        </div>
      )}

      {canAct && (
        <div className="flex gap-2 pt-2">
          <form action={acceptInvitation} className="flex-1">
            <input type="hidden" name="appId" value={a.id} />
            <button className="btn-accent w-full">
              <CheckCircle2 className="w-4 h-4" />
              Принять
            </button>
          </form>
          <form action={declineInvitation}>
            <input type="hidden" name="appId" value={a.id} />
            <button className="btn-secondary" title="Отклонить">
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

function MyAppCard({ a }: { a: any }) {
  const isClosed = a.shift.status === "CLOSED";
  const showLabel =
    a.status === "PENDING" && isClosed ? "Смена закрыта" : STATUS_LABEL[a.status];
  const showClass =
    a.status === "PENDING" && isClosed ? "badge-muted" : STATUS_CLASS[a.status];

  return (
    <li>
      <Link href={`/shift/${a.shift.id}`} className="card-interactive block cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge-neutral">{a.shift.position.name}</span>
            </div>
            <h3 className="font-semibold text-ink-900 mb-2">{a.shift.title}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5 text-ink-900 font-medium">
                <Calendar className="w-3.5 h-3.5 text-accent-500" />
                {shiftLabel(a.shift.shiftStart, a.shift.shiftEnd)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-900 font-medium">
                <Wallet className="w-3.5 h-3.5 text-accent-500" />
                {formatRub(a.shift.payment)} ₽
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-700">
                <Building2 className="w-3.5 h-3.5 text-ink-400" />
                {a.shift.hr.hrProfile?.hotelName}
              </span>
            </div>
          </div>
          <span className={showClass}>{showLabel}</span>
        </div>
      </Link>
    </li>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
