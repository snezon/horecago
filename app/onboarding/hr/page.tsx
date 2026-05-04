import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { saveHrOnboarding } from "./actions";

export default async function HROnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Шаг 1 из 1</div>
        <h1 className="text-3xl font-bold mb-1">Профиль работодателя</h1>
        <p className="text-ink-500 text-sm">Эти данные увидят соискатели в вашей вакансии</p>
      </div>

      <form action={saveHrOnboarding} className="card space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Контактное лицо</label>
            <input name="name" className="input" defaultValue={user.name ?? ""} required />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input name="phone" className="input" defaultValue={user.phone ?? ""} required placeholder="+7..." />
          </div>
        </div>
        <div>
          <label className="label">Название отеля или заведения</label>
          <input name="hotelName" className="input" defaultValue={user.hrProfile?.hotelName ?? ""} required />
        </div>
        <div>
          <label className="label">Адрес</label>
          <input name="address" className="input" defaultValue={user.hrProfile?.address ?? ""} required placeholder="Москва, Тверская 1" />
        </div>
        <button className="btn-primary w-full !py-3">Сохранить и продолжить</button>
      </form>
    </div>
  );
}
