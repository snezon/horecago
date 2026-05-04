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
    <div className="max-w-2xl mx-auto card">
      <h1 className="text-2xl font-semibold mb-1">Профиль соискателя</h1>
      <p className="text-sm text-gray-600 mb-6">Заполните информацию — она нужна работодателю.</p>

      <form action={saveWorkerOnboarding} className="space-y-4">
        <div>
          <label className="label">Имя</label>
          <input name="name" className="input" defaultValue={user.name ?? ""} required />
        </div>
        <div>
          <label className="label">Телефон</label>
          <input name="phone" className="input" defaultValue={user.phone ?? ""} required placeholder="+7..." />
        </div>
        <div>
          <label className="label">Адрес (район или станция метро)</label>
          <input name="address" className="input" defaultValue={user.workerProfile?.address ?? ""} placeholder="м. Тверская" />
        </div>
        <div>
          <label className="label">О себе</label>
          <textarea name="about" className="input min-h-[80px]" defaultValue={user.workerProfile?.about ?? ""} placeholder="Опыт, языки, что важно..." />
        </div>
        <div>
          <label className="label">На каких позициях работаете</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {positions.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="skills"
                  value={p.id}
                  defaultChecked={skillIds.has(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary w-full">Сохранить</button>
      </form>
    </div>
  );
}
