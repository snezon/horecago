import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft, MapPin, Wallet, Calendar, FileText, Phone, Mail, CheckCircle2,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteWorker } from "./actions";
import { shiftLabel, formatRub } from "@/lib/datetime";

const kindLabel: Record<string, string> = {
  PASSPORT: "Паспорт",
  MED_BOOK: "Медкнижка",
  OTHER: "Другое",
};

export default async function WorkerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { invited?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");

  const worker = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      workerProfile: {
        include: {
          skills: { include: { position: true } },
          documents: true,
        },
      },
    },
  });
  if (!worker || worker.role !== "WORKER" || !worker.workerProfile) notFound();

  // HR's own open shifts (for invite dropdown)
  const myShifts = await prisma.shift.findMany({
    where: { hrId: user.id, status: "OPEN", shiftEnd: { gte: new Date() } },
    include: { position: true },
    orderBy: { shiftStart: "asc" },
  });

  // Existing applications between this worker and HR's shifts
  const existingApps = await prisma.application.findMany({
    where: {
      workerId: worker.id,
      shift: { hrId: user.id },
    },
    include: { shift: { include: { position: true } } },
    orderBy: { createdAt: "desc" },
  });
  const existingShiftIds = new Set(existingApps.map((a) => a.shiftId));
  const availableShifts = myShifts.filter((s) => !existingShiftIds.has(s.id));

  const skills = worker.workerProfile.skills.map((s) => s.position.name);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/workers" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="w-4 h-4" /> К соискателям
      </Link>

      {searchParams.invited && (
        <div className="card border-emerald-200 bg-emerald-50/50 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm text-emerald-900 font-medium">Приглашение отправлено</div>
        </div>
      )}

      <article className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-ink-900 text-accent-400 text-xl font-semibold shrink-0">
            {(worker.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-900">{worker.name ?? "Без имени"}</h1>
            {worker.workerProfile.address && (
              <div className="flex items-center gap-1.5 text-sm text-ink-500 mt-0.5">
                <MapPin className="w-3.5 h-3.5" /> {worker.workerProfile.address}
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {worker.workerProfile.minPayment != null && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-ink-50/70">
              <Wallet className="w-4 h-4 text-accent-500 mt-0.5" />
              <div>
                <div className="text-xs text-ink-500">Мин. ставка</div>
                <div className="text-sm font-semibold text-ink-900">от {formatRub(worker.workerProfile.minPayment)} ₽ за смену</div>
              </div>
            </div>
          )}
          {worker.workerProfile.availabilityNote && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-ink-50/70">
              <Calendar className="w-4 h-4 text-accent-500 mt-0.5" />
              <div>
                <div className="text-xs text-ink-500">Доступность</div>
                <div className="text-sm text-ink-800">{worker.workerProfile.availabilityNote}</div>
              </div>
            </div>
          )}
        </div>

        {skills.length > 0 && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-wide text-ink-500 mb-2">Позиции</div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="text-sm bg-ink-100 text-ink-700 px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}

        {worker.workerProfile.about && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-wide text-ink-500 mb-2">О себе</div>
            <p className="text-sm text-ink-700 leading-relaxed">{worker.workerProfile.about}</p>
          </div>
        )}

        <div className="border-t border-ink-200/70 pt-4">
          <div className="text-xs uppercase tracking-wide text-ink-500 mb-2">Контакты</div>
          <div className="flex flex-wrap gap-3 text-sm">
            {worker.phone && (
              <a href={`tel:${worker.phone}`} className="inline-flex items-center gap-1.5 text-ink-900 hover:text-ink-700">
                <Phone className="w-4 h-4 text-ink-400" /> {worker.phone}
              </a>
            )}
            <a href={`mailto:${worker.email}`} className="inline-flex items-center gap-1.5 text-ink-900 hover:text-ink-700">
              <Mail className="w-4 h-4 text-ink-400" /> {worker.email}
            </a>
          </div>
        </div>

        {worker.workerProfile.documents.length > 0 && (
          <div className="border-t border-ink-200/70 pt-4 mt-4">
            <div className="text-xs uppercase tracking-wide text-ink-500 mb-2">Документы</div>
            <ul className="flex flex-wrap gap-2">
              {worker.workerProfile.documents.map((d) => (
                <li key={d.id}>
                  <a href={d.url} target="_blank" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink-50 border border-ink-200 text-sm text-ink-700 hover:border-ink-400 hover:bg-white">
                    <FileText className="w-3.5 h-3.5 text-ink-400" />
                    {kindLabel[d.kind] ?? d.kind}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      {/* Invite to shift */}
      <section className="card">
        <h2 className="section-title mb-4">Пригласить на смену</h2>

        {availableShifts.length === 0 && existingApps.length > 0 && (
          <p className="text-sm text-ink-500">
            Все ваши открытые смены уже отправлены этому кандидату.
          </p>
        )}
        {myShifts.length === 0 && (
          <p className="text-sm text-ink-500">
            У вас пока нет открытых смен. <Link href="/hr/shifts/new" className="text-ink-900 underline">Создать</Link>
          </p>
        )}

        {availableShifts.length > 0 && (
          <form action={inviteWorker} className="space-y-4">
            <input type="hidden" name="workerId" value={worker.id} />
            <div>
              <label className="label">Смена</label>
              <select name="shiftId" className="input" required>
                {availableShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {shiftLabel(s.shiftStart, s.shiftEnd)} — {formatRub(s.payment)} ₽
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Сообщение (опц.)</label>
              <textarea name="message" className="input min-h-[60px]" placeholder="Что важно сказать кандидату..." />
            </div>
            <button className="btn-accent">Отправить приглашение</button>
          </form>
        )}

        {existingApps.length > 0 && (
          <div className="mt-6 pt-4 border-t border-ink-200/70">
            <div className="text-xs uppercase tracking-wide text-ink-500 mb-2">История</div>
            <ul className="space-y-1.5 text-sm">
              {existingApps.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span className="text-ink-700 truncate">
                    {a.shift.title} · {shiftLabel(a.shift.shiftStart, a.shift.shiftEnd)}
                  </span>
                  <span className={`text-xs shrink-0 ml-2 ${
                    a.status === "HIRED" ? "text-emerald-700"
                    : a.status === "REJECTED" ? "text-ink-500"
                    : "text-accent-700"
                  }`}>
                    {statusLabel(a)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function statusLabel(a: { initiator: string; status: string }) {
  if (a.status === "HIRED") return "Подтверждено";
  if (a.status === "REJECTED") return a.initiator === "HR" ? "Отклонено кандидатом" : "Отклонено";
  return a.initiator === "HR" ? "Приглашение отправлено" : "Заявка от кандидата";
}
