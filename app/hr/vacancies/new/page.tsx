import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    <div className="max-w-2xl mx-auto">
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> К дашборду
      </Link>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Новая вакансия</h1>
        <p className="text-ink-500 text-sm">Опубликуйте — и сразу начнёте получать отклики</p>
      </div>
      <form action={createVacancy} className="card space-y-5">
        <div className="grid sm:grid-cols-[1fr,140px] gap-4">
          <div>
            <label className="label">Должность</label>
            <select name="positionId" className="input" required>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Сколько нужно</label>
            <input name="headcount" type="number" min={1} defaultValue={1} className="input" required />
          </div>
        </div>
        <div>
          <label className="label">Заголовок</label>
          <input name="title" className="input" required placeholder="Горничная в отель 4*" />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea name="description" className="input min-h-[140px]" required placeholder="График работы, требования к опыту, что предлагаете..." />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Зарплата</label>
            <input name="salary" className="input" placeholder="от 60 000 ₽" />
          </div>
          <div>
            <label className="label">Адрес</label>
            <input name="address" className="input" required defaultValue={user.hrProfile.address} />
          </div>
        </div>
        <button className="btn-primary w-full !py-3">Опубликовать</button>
      </form>
    </div>
  );
}
