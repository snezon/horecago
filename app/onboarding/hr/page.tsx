import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { saveHrOnboarding } from "./actions";

export default async function HROnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=HR");
  if (user.role !== "HR") redirect("/");

  return (
    <div className="max-w-2xl mx-auto card">
      <h1 className="text-2xl font-semibold mb-1">Профиль работодателя</h1>
      <p className="text-sm text-gray-600 mb-6">Эти данные увидят соискатели в вакансии.</p>

      <form action={saveHrOnboarding} className="space-y-4">
        <div>
          <label className="label">Контактное лицо (HR)</label>
          <input name="name" className="input" defaultValue={user.name ?? ""} required />
        </div>
        <div>
          <label className="label">Телефон</label>
          <input name="phone" className="input" defaultValue={user.phone ?? ""} required placeholder="+7..." />
        </div>
        <div>
          <label className="label">Название отеля</label>
          <input name="hotelName" className="input" defaultValue={user.hrProfile?.hotelName ?? ""} required />
        </div>
        <div>
          <label className="label">Адрес отеля</label>
          <input name="address" className="input" defaultValue={user.hrProfile?.address ?? ""} required placeholder="Москва, Тверская 1" />
        </div>
        <button className="btn-primary w-full">Сохранить</button>
      </form>
    </div>
  );
}
