import { redirect } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agencyIdsOf } from "@/lib/domain/access";
import { sendWorkerInvite } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ждём подтверждения",
  ACTIVE: "Работает с вами",
  REVOKED: "Отозвано",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-warning",
  ACTIVE: "badge-neutral",
  REVOKED: "badge-muted",
};

export default async function AgencyDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=AGENCY");
  if (user.role !== "AGENCY") redirect("/");

  const [agencyId] = await agencyIdsOf(user.id);
  if (!agencyId) redirect("/onboarding/agency");

  const org = await prisma.org.findUnique({ where: { id: agencyId } });
  if (!org) redirect("/onboarding/agency");

  const reps = await prisma.representation.findMany({
    where: { agencyId },
    include: { worker: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Кабинет агентства</div>
        <h1 className="text-3xl font-bold text-ink-900">{org.name}</h1>
      </div>

      {!org.verified && (
        <div className="card !p-4 border-amber-200 bg-amber-50/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Агентство на проверке. Заявки заказчиков станут видны после неё —
            обычно в течение рабочего дня.
          </p>
        </div>
      )}

      <section className="card space-y-4">
        <h2 className="section-title">Пригласить работника</h2>
        <form action={sendWorkerInvite} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Email работника</label>
            <input name="email" type="email" className="input" required placeholder="ivan@example.com" />
          </div>
          <button className="btn-primary !px-5 !py-2.5">
            <UserPlus className="w-4 h-4" />
            Пригласить
          </button>
        </form>
        <p className="text-xs text-ink-500">
          Мы отправим человеку ссылку. Профиль он заполнит сам — передавать нам
          чужие контакты списком закон не позволяет.
        </p>
      </section>

      <section>
        <h2 className="section-title mb-4">Представительства</h2>
        {reps.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-ink-600">Пока никого не пригласили</p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500 border-b border-ink-100">
                  <th className="px-4 py-3 font-medium">Работник</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => (
                  <tr key={rep.id} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-3 text-ink-900">{rep.worker.name || rep.worker.email}</td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[rep.status] ?? "badge-neutral"}>
                        {STATUS_LABELS[rep.status] ?? rep.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-500">
                      {rep.createdAt.toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
