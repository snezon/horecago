import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createVacancy } from "../actions";

export default async function NewVacancyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");
  if (!user.hrProfile) redirect("/onboarding/hr");

  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="max-w-2xl mx-auto card">
      <h1 className="text-2xl font-semibold mb-4">Новая вакансия</h1>
      <form action={createVacancy} className="space-y-4">
        <div>
          <label className="label">Должность</label>
          <select name="positionId" className="input" required>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Заголовок</label>
          <input name="title" className="input" required placeholder="Горничная в отель 4*" />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea name="description" className="input min-h-[120px]" required placeholder="График, требования, что важно..." />
        </div>
        <div>
          <label className="label">Зарплата</label>
          <input name="salary" className="input" placeholder="от 60 000 ₽" />
        </div>
        <div>
          <label className="label">Адрес работы</label>
          <input name="address" className="input" required defaultValue={user.hrProfile.address} />
        </div>
        <div>
          <label className="label">Сколько человек нужно</label>
          <input name="headcount" type="number" min={1} defaultValue={1} className="input" required />
        </div>
        <button className="btn-primary">Опубликовать</button>
      </form>
    </div>
  );
}
