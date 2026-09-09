import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { saveAgencyOnboarding } from "./actions";

export default async function AgencyOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=AGENCY");
  if (user.role !== "AGENCY") redirect("/");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Шаг 1 из 1</div>
        <h1 className="text-3xl font-bold mb-1">Профиль агентства</h1>
        <p className="text-ink-500 text-sm">Эти данные увидят заказчики и работники, которых вы приглашаете</p>
      </div>

      <form action={saveAgencyOnboarding} className="card space-y-5">
        <div>
          <label className="label">Название агентства</label>
          <input name="name" className="input" required />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Контактное лицо</label>
            <input name="contactName" className="input" defaultValue={user.name ?? ""} required />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input name="phone" className="input" defaultValue={user.phone ?? ""} required placeholder="+7..." />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Юридическое лицо</label>
            <input name="legalName" className="input" placeholder="ООО «Кадры»" />
          </div>
          <div>
            <label className="label">ИНН</label>
            <input name="inn" className="input" placeholder="7712345678" />
          </div>
        </div>
        <button className="btn-primary w-full !py-3">Сохранить и продолжить</button>
      </form>
      <p className="text-xs text-ink-500 mt-4">
        После заполнения мы проверим агентство. Заявки заказчиков станут видны после проверки.
      </p>
    </div>
  );
}
