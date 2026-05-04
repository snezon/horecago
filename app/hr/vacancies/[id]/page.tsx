import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
              applications: false,
            },
          },
        },
      },
    },
  });
  if (!vacancy || vacancy.hrId !== user.id) notFound();

  // Get documents per applicant
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

  return (
    <div className="space-y-6">
      <Link href="/hr" className="text-sm text-gray-500 hover:text-gray-900">← К дашборду</Link>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">{vacancy.title}</h1>
            <p className="text-sm text-gray-600">{vacancy.position.name}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium text-lg">{vacancy.hiredCount} / {vacancy.headcount}</div>
            <div className="text-gray-500">нанято</div>
            {vacancy.status === "CLOSED" && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-gray-200 rounded">Закрыта</span>
            )}
          </div>
        </div>

        <form action={updateVacancy} className="space-y-3">
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
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Отклики ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="card text-sm text-gray-500">Новых откликов нет</div>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => {
              const wDocs = docsByWorker.get(a.workerId) ?? [];
              const skills = a.worker.workerProfile?.skills.map((s) => s.position.name) ?? [];
              return (
                <li key={a.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="font-semibold">{a.worker.name ?? "Без имени"}</div>
                      <div className="text-sm text-gray-600">
                        📞 <a href={`tel:${a.worker.phone}`} className="text-brand-600">{a.worker.phone}</a>
                        {" · "}
                        ✉️ <a href={`mailto:${a.worker.email}`} className="text-brand-600">{a.worker.email}</a>
                      </div>
                      {a.worker.workerProfile?.address && (
                        <div className="text-sm text-gray-600">📍 {a.worker.workerProfile.address}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <form action={hireApplicant}>
                        <input type="hidden" name="appId" value={a.id} />
                        <button className="btn-primary">Нанять</button>
                      </form>
                      <form action={rejectApplicant}>
                        <input type="hidden" name="appId" value={a.id} />
                        <button className="btn-secondary">Отклонить</button>
                      </form>
                    </div>
                  </div>

                  {a.worker.workerProfile?.about && (
                    <p className="text-sm text-gray-700 mb-2">{a.worker.workerProfile.about}</p>
                  )}

                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {skills.map((s) => (
                        <span key={s} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  )}

                  {wDocs.length > 0 && (
                    <div className="text-sm">
                      <div className="text-gray-500 mb-1">Документы:</div>
                      <ul className="flex flex-wrap gap-2">
                        {wDocs.map((d) => (
                          <li key={d.id}>
                            <a href={d.url} target="_blank" className="text-brand-600 hover:underline">
                              {kindLabel[d.kind] ?? d.kind} ({d.filename})
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
          <h2 className="text-lg font-semibold mb-3">Нанятые ({hired.length})</h2>
          <ul className="space-y-2">
            {hired.map((a) => (
              <li key={a.id} className="card text-sm">
                <span className="font-medium">{a.worker.name}</span>
                <span className="text-gray-500 ml-2">{a.worker.phone}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rejected.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-gray-500">Отклонённые ({rejected.length})</h2>
          <ul className="space-y-2 opacity-70">
            {rejected.map((a) => (
              <li key={a.id} className="card text-sm">
                <span className="font-medium">{a.worker.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
