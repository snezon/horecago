import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveWorkerOnboarding } from "@/app/onboarding/worker/actions";
import { deleteDocument } from "./actions";

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

  const kindLabel: Record<string, string> = {
    PASSPORT: "Паспорт",
    MED_BOOK: "Медкнижка",
    OTHER: "Другое",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold mb-4">Мой профиль</h1>
        <form action={saveWorkerOnboarding} className="space-y-4">
          <div>
            <label className="label">Имя</label>
            <input name="name" className="input" defaultValue={user.name ?? ""} required />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input name="phone" className="input" defaultValue={user.phone ?? ""} required />
          </div>
          <div>
            <label className="label">Адрес</label>
            <input name="address" className="input" defaultValue={user.workerProfile?.address ?? ""} />
          </div>
          <div>
            <label className="label">О себе</label>
            <textarea name="about" className="input min-h-[80px]" defaultValue={user.workerProfile?.about ?? ""} />
          </div>
          <div>
            <label className="label">Позиции</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {positions.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="skills" value={p.id} defaultChecked={skillIds.has(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary">Сохранить</button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Документы</h2>
        <p className="text-sm text-gray-600 mb-4">
          Загрузите паспорт и медкнижку — работодатели увидят их в вашем отклике.
        </p>

        <form action="/api/documents" method="post" encType="multipart/form-data" className="flex flex-wrap gap-2 items-end mb-4">
          <div className="flex-1 min-w-[180px]">
            <label className="label">Тип</label>
            <select name="kind" className="input">
              <option value="PASSPORT">Паспорт</option>
              <option value="MED_BOOK">Медкнижка</option>
              <option value="OTHER">Другое</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="label">Файл</label>
            <input type="file" name="file" required className="input" />
          </div>
          <button className="btn-primary">Загрузить</button>
        </form>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">Документов нет</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{kindLabel[d.kind] ?? d.kind}</span>
                  <span className="text-gray-500 ml-2">{d.filename}</span>
                </div>
                <div className="flex items-center gap-3">
                  <a href={d.url} target="_blank" className="text-brand-600 hover:underline">Открыть</a>
                  <form action={deleteDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="text-red-600 hover:underline">Удалить</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
