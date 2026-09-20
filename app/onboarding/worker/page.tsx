import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toDateInput } from "@/lib/datetime";
import { LocationFields } from "@/app/_components/LocationFields";
import { METRO_CITIES } from "@/lib/domain/metro";
import { saveWorkerOnboarding } from "./actions";

export default async function WorkerOnboardingPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
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

      {searchParams.error === "consent" && (
        <div className="mb-4 text-sm text-red-600">
          Без согласия на обработку персональных данных профиль сохранить нельзя.
        </div>
      )}

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
        <LocationFields
          defaultCity={user.workerProfile?.city ?? ""}
          defaultMetro={user.workerProfile?.metro ?? ""}
          metroCities={METRO_CITIES}
        />
        <div>
          <label className="label">О себе</label>
          <textarea name="about" className="input min-h-[90px]" defaultValue={user.workerProfile?.about ?? ""} placeholder="Опыт, языки, что важно..." />
        </div>
        <div>
          <label className="label">Мин. ставка ₽ за смену (опц.)</label>
          <input name="minPayment" type="number" min={0} step={100} className="input" defaultValue={user.workerProfile?.minPayment ?? ""} placeholder="4000" />
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
        <div className="rounded-xl border border-ink-200 p-4 space-y-3">
          <div className="text-sm font-semibold text-ink-900">Допуск к работе</div>
          <label className="flex items-start gap-2.5 text-sm text-ink-700">
            <input type="checkbox" name="hasMedBook" value="1" defaultChecked={user.workerProfile?.hasMedBook ?? false} className="accent-ink-900 mt-0.5" />
            <span>Есть медицинская книжка</span>
          </label>
          <div className="sm:max-w-[220px]">
            <label className="label">Медкнижка действует до</label>
            <input
              type="date"
              name="medBookExpiresAt"
              className="input"
              defaultValue={user.workerProfile?.medBookExpiresAt ? toDateInput(user.workerProfile.medBookExpiresAt) : ""}
            />
          </div>
          <label className="flex items-start gap-2.5 text-sm text-ink-700">
            <input type="checkbox" name="hasWorkPermit" value="1" defaultChecked={user.workerProfile?.hasWorkPermit ?? false} className="accent-ink-900 mt-0.5" />
            <span>Есть разрешение на работу в РФ — если вы не гражданин РФ</span>
          </label>
          <p className="text-xs text-ink-500">Заказчик видит это как ваши слова. Скан можно приложить в профиле, в разделе «Документы».</p>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-ink-700">
          <input type="checkbox" name="consent" value="1" required className="accent-ink-900 mt-0.5" />
          <span>
            Я согласен на обработку персональных данных согласно{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              политике обработки персональных данных
            </a>
          </span>
        </label>
        <button className="btn-primary w-full !py-3">Сохранить и продолжить</button>
      </form>
    </div>
  );
}
