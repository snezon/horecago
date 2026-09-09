import { redirect } from "next/navigation";
import { FileText, Trash2, Upload, ExternalLink, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { representingAgencies } from "@/lib/domain/representation";
import { hasConsent } from "@/lib/domain/consent";
import { saveWorkerOnboarding } from "@/app/onboarding/worker/actions";
import { deleteDocument, revokeMyRepresentation } from "./actions";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "WORKER") redirect("/");

  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });
  const skills = await prisma.workerSkill.findMany({ where: { workerId: user.id } });
  const skillIds = new Set(skills.map((s) => s.positionId));
  const documents = await prisma.document.findMany({
    where: { workerId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const agencies = (await representingAgencies([user.id])).get(user.id) ?? [];
  const consented = await hasConsent(user.id);

  const kindLabel: Record<string, string> = {
    PASSPORT: "Паспорт",
    MED_BOOK: "Медкнижка",
    OTHER: "Другое",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Мой профиль</h1>
        <p className="text-ink-500 text-sm">Эти данные увидит работодатель в вашем отклике</p>
      </div>

      <section className="card">
        <h2 className="section-title mb-5">Личные данные</h2>
        <form action={saveWorkerOnboarding} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Имя</label>
              <input name="name" className="input" defaultValue={user.name ?? ""} required />
            </div>
            <div>
              <label className="label">Телефон</label>
              <input name="phone" className="input" defaultValue={user.phone ?? ""} required />
            </div>
          </div>
          <div>
            <label className="label">Адрес (район или метро)</label>
            <input name="address" className="input" defaultValue={user.workerProfile?.address ?? ""} />
          </div>
          <div>
            <label className="label">О себе</label>
            <textarea name="about" className="input min-h-[90px]" defaultValue={user.workerProfile?.about ?? ""} placeholder="Опыт, языки, что важно..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Мин. ставка ₽ за смену</label>
              <input name="minPayment" type="number" min={0} step={100} className="input" defaultValue={user.workerProfile?.minPayment ?? ""} placeholder="4000" />
            </div>
            <div>
              <label className="label">Когда свободен</label>
              <input name="availabilityNote" className="input" defaultValue={user.workerProfile?.availabilityNote ?? ""} placeholder="будни вечер, выходные днём" />
            </div>
          </div>
          <div>
            <label className="label">На каких позициях работаете</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {positions.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-ink-200 hover:border-ink-300 cursor-pointer text-sm">
                  <input type="checkbox" name="skills" value={p.id} defaultChecked={skillIds.has(p.id)} className="accent-ink-900" />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary !py-2.5">Сохранить</button>
        </form>
      </section>

      {agencies.length > 0 && (
        <section className="card">
          <h2 className="section-title mb-5">Кто вас представляет</h2>
          <ul className="space-y-2">
            {agencies.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-ink-200/70">
                <div className="font-medium text-sm text-ink-900">{a.name}</div>
                <form action={revokeMyRepresentation}>
                  <input type="hidden" name="agencyId" value={a.id} />
                  <button className="btn-danger-ghost !py-1.5 !px-3 text-sm">Отозвать</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-500 mt-4">Отзыв не удаляет историю ваших смен.</p>
        </section>
      )}

      <section className="card">
        <h2 className="section-title mb-2">Документы</h2>
        <p className="text-sm text-ink-600 mb-5">
          Паспорт и медкнижка. Работодатель увидит их сразу в отклике.
        </p>

        {consented ? (
          <form action="/api/documents" method="post" encType="multipart/form-data" className="flex flex-wrap gap-3 items-end mb-6 p-4 rounded-xl bg-ink-50 border border-ink-200/70">
            <div className="flex-1 min-w-[160px]">
              <label className="label">Тип</label>
              <select name="kind" className="input">
                <option value="PASSPORT">Паспорт</option>
                <option value="MED_BOOK">Медкнижка</option>
                <option value="OTHER">Другое</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="label">Файл</label>
              <input type="file" name="file" required className="input file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-ink-100 file:text-ink-700 file:text-xs" />
            </div>
            <button className="btn-primary">
              <Upload className="w-4 h-4" />
              Загрузить
            </button>
          </form>
        ) : (
          <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Чтобы загружать документы, нужно принять условия обработки
              персональных данных.{" "}
              <a href="/onboarding/worker" className="underline">
                Сделать это можно здесь
              </a>.
            </p>
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-6">Документы не загружены</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-ink-200/70 hover:border-ink-300 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-ink-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-ink-900">{kindLabel[d.kind] ?? d.kind}</div>
                    <div className="text-xs text-ink-500 truncate">{d.filename}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={d.url} target="_blank" className="btn-ghost !py-1.5 !px-2" title="Открыть">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <form action={deleteDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="btn-danger-ghost !py-1.5 !px-2" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
