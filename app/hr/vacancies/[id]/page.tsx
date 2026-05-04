import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Phone, Mail, MapPin, FileText, CheckCircle2, X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateVacancy, hireApplicant, rejectApplicant } from "../actions";

const kindLabel: Record<string, string> = {
  PASSPORT: "Паспорт",
  MED_BOOK: "Медкнижка",
  OTHER: "Другое",
};

export default async function HRVacancyPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");

  const vacancy = await prisma.vacancy.findUnique({
    where: { id: params.id },
    include: {
      position: true,
      applications: {
        orderBy: { createdAt: "desc" },
        include: {
          worker: {
            include: {
              workerProfile: { include: { skills: { include: { position: true } } } },
            },
          },
        },
      },
    },
  });
  if (!vacancy || vacancy.hrId !== user.id) notFound();

  const workerIds = vacancy.applications.map((a) => a.workerId);
  const docs = workerIds.length
    ? await prisma.document.findMany({ where: { workerId: { in: workerIds } } })
    : [];
  const docsByWorker = new Map<string, typeof docs>();
  for (const d of docs) {
    const list = docsByWorker.get(d.workerId) ?? [];
    list.push(d);
    docsByWorker.set(d.workerId, list);
  }

  const pending = vacancy.applications.filter((a) => a.status === "PENDING");
  const hired = vacancy.applications.filter((a) => a.status === "HIRED");
  const rejected = vacancy.applications.filter((a) => a.status === "REJECTED");

  const progress = (vacancy.hiredCount / vacancy.headcount) * 100;

  return (
    <div className="space-y-6">
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="w-4 h-4" /> К дашборду
      </Link>

      {/* Vacancy header */}
      <article className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="badge-neutral">{vacancy.position.name}</span>
              {vacancy.status === "CLOSED" && <span className="badge-muted">Закрыта</span>}
            </div>
            <h1 className="text-2xl font-bold">{vacancy.title}</h1>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-ink-900">
              {vacancy.hiredCount}<span className="text-ink-400 text-lg font-normal"> / {vacancy.headcount}</span>
            </div>
            <div className="text-xs text-ink-500 uppercase tracking-wide">нанято</div>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden mb-6">
          <div className="h-full bg-accent-500 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-ink-600 hover:text-ink-900 select-none">Редактировать вакансию</summary>
          <form action={updateVacancy} className="space-y-4 mt-4 pt-4 border-t border-ink-200/70">
            <input type="hidden" name="id" value={vacancy.id} />
            <div>
              <label className="label">Заголовок</label>
              <input name="title" defaultValue={vacancy.title} className="input" />
            </div>
            <div>
              <label className="label">Описание</label>
              <textarea name="description" defaultValue={vacancy.description} className="input min-h-[100px]" />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Зарплата</label>
                <input name="salary" defaultValue={vacancy.salary ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Адрес</label>
                <input name="address" defaultValue={vacancy.address} className="input" />
              </div>
              <div>
                <label className="label">Headcount</label>
                <input name="headcount" type="number" min={vacancy.hiredCount} defaultValue={vacancy.headcount} className="input" />
              </div>
            </div>
            <button className="btn-secondary">Сохранить</button>
          </form>
        </details>
      </article>

      {/* Pending applications */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Новые отклики</h2>
          <span className="text-sm text-ink-500">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <div className="card text-center text-sm text-ink-500 py-8">Новых откликов нет</div>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => {
              const wDocs = docsByWorker.get(a.workerId) ?? [];
              const skills = a.worker.workerProfile?.skills.map((s) => s.position.name) ?? [];
              return (
                <li key={a.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink-900 text-accent-400 font-semibold">
                          {(a.worker.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-ink-900">{a.worker.name ?? "Без имени"}</div>
                          {a.worker.workerProfile?.address && (
                            <div className="flex items-center gap-1 text-xs text-ink-500">
                              <MapPin className="w-3 h-3" /> {a.worker.workerProfile.address}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {a.worker.phone && (
                          <a href={`tel:${a.worker.phone}`} className="inline-flex items-center gap-1.5 text-ink-700 hover:text-ink-900">
                            <Phone className="w-4 h-4 text-ink-400" /> {a.worker.phone}
                          </a>
                        )}
                        <a href={`mailto:${a.worker.email}`} className="inline-flex items-center gap-1.5 text-ink-700 hover:text-ink-900">
                          <Mail className="w-4 h-4 text-ink-400" /> {a.worker.email}
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <form action={hireApplicant}>
                        <input type="hidden" name="appId" value={a.id} />
                        <button className="btn-accent">
                          <CheckCircle2 className="w-4 h-4" />
                          Нанять
                        </button>
                      </form>
                      <form action={rejectApplicant}>
                        <input type="hidden" name="appId" value={a.id} />
                        <button className="btn-secondary" title="Отклонить">
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </div>

                  {a.worker.workerProfile?.about && (
                    <p className="text-sm text-ink-700 mb-3 leading-relaxed">{a.worker.workerProfile.about}</p>
                  )}

                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {skills.map((s) => (
                        <span key={s} className="text-xs bg-ink-100 text-ink-700 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}

                  {wDocs.length > 0 && (
                    <div className="pt-3 border-t border-ink-200/70">
                      <div className="text-xs uppercase tracking-wide text-ink-500 mb-2">Документы</div>
                      <ul className="flex flex-wrap gap-2">
                        {wDocs.map((d) => (
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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {hired.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Нанятые</h2>
            <span className="text-sm text-ink-500">{hired.length}</span>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {hired.map((a) => (
              <li key={a.id} className="card !p-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{a.worker.name}</div>
                    <div className="text-xs text-ink-500">{a.worker.phone}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rejected.length > 0 && (
        <section>
          <details className="card">
            <summary className="cursor-pointer text-sm text-ink-500">Отклонённые ({rejected.length})</summary>
            <ul className="mt-3 space-y-1 text-sm text-ink-500">
              {rejected.map((a) => (
                <li key={a.id}>{a.worker.name}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}
