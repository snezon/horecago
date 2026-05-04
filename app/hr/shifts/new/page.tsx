import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createShift } from "../actions";
import { toLocalInput } from "@/lib/datetime";

export default async function NewShiftPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");
  if (!user.hrProfile) redirect("/onboarding/hr");

  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> К дашборду
      </Link>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Новая смена</h1>
        <p className="text-ink-500 text-sm">Опубликуйте — и сразу начнёте получать заявки</p>
      </div>
      <form action={createShift} className="card space-y-5">
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
          <input name="title" className="input" required placeholder="Горничная, утренняя смена" />
        </div>

        <div>
          <label className="label">Описание</label>
          <textarea name="description" className="input min-h-[120px]" required placeholder="Что делать, требования к опыту, что предлагаете..." />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Начало смены</label>
            <input name="shiftStart" type="datetime-local" className="input" required defaultValue={toLocalInput(start)} />
          </div>
          <div>
            <label className="label">Конец смены</label>
            <input name="shiftEnd" type="datetime-local" className="input" required defaultValue={toLocalInput(end)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr,160px] gap-4">
          <div>
            <label className="label">Оплата за смену, ₽</label>
            <input name="payment" type="number" min={0} step={100} className="input" required placeholder="4500" />
          </div>
          <div>
            <label className="label">Доп. (опц.)</label>
            <input name="paymentNote" className="input" placeholder="+ чай" />
          </div>
        </div>

        <div>
          <label className="label">Адрес</label>
          <input name="address" className="input" required defaultValue={user.hrProfile.address} />
        </div>

        <button className="btn-primary w-full !py-3">Опубликовать</button>
      </form>
    </div>
  );
}
