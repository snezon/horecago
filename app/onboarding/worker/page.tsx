import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveWorkerOnboarding } from "./actions";

export default async function WorkerOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=WORKER");
  if (user.role !== "WORKER") redirect("/");

  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });
  const existingSkills = user.workerProfile
    ? await prisma.workerSkill.findMany({ where: { workerId: user.id } })
    : [];
  const skillIds = new Set(existingSkills.map((s) => s.positionId));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Шаг 1 из 1</div>
        <h1 className="text-3xl font-bold mb-1">Профиль соискателя</h1>
        <p className="text-ink-500 text-sm">Эту информацию увидит работодатель в вашем отклике</p>
      </div>

      <form action={saveWorkerOnboarding} className="card space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Имя</label>
            <input name="name" className="input" defaultValue={user.name ?? ""} required />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input name="phone" className="input" defaultValue={user.phone ?? ""} required placeholder="+7..." />
          </div>
        </div>
        <div>
          <label className="label">Адрес (район или станция метро)</label>
          <input name="address" className="input" defaultValue={user.workerProfile?.address ?? ""} placeholder="м. Тверская" />
        </div>
        <div>
          <label className="label">О себе</label>
          <textarea name="about" className="input min-h-[90px]" defaultValue={user.workerProfile?.about ?? ""} placeholder="Опыт, языки, что важно..." />
        </div>
        <div>
          <label className="label">На каких позициях работаете</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {positions.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-ink-200 hover:border-ink-300 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  name="skills"
                  value={p.id}
                  defaultChecked={skillIds.has(p.id)}
                  className="accent-ink-900"
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary w-full !py-3">Сохранить и продолжить</button>
      </form>
    </div>
  );
}
