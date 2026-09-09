import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/domain/access";
import { setOrgVerified } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  CLIENT: "Заказчик",
  AGENCY: "Агентство",
};

export default async function AdminOrgsPage() {
  const user = await requireUser();
  if (!isAdmin(user.email)) redirect("/");

  const orgs = await prisma.org.findMany({
    orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
    include: {
      memberships: { include: { user: true }, where: { role: "OWNER" } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Админка</div>
        <h1 className="text-3xl font-bold text-ink-900">Организации</h1>
      </div>

      {orgs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-ink-600">Организаций пока нет</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500 border-b border-ink-100">
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">ИНН</th>
                <th className="px-4 py-3 font-medium">Владелец</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => {
                const owner = org.memberships[0]?.user;
                return (
                  <tr key={org.id} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-3 text-ink-900 font-medium">{org.name}</td>
                    <td className="px-4 py-3 text-ink-700">{TYPE_LABELS[org.type] ?? org.type}</td>
                    <td className="px-4 py-3 text-ink-700">{org.inn || "—"}</td>
                    <td className="px-4 py-3 text-ink-700">
                      {owner ? (owner.name ? `${owner.name} (${owner.email})` : owner.email) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {org.verified ? (
                        <span className="badge-success">Проверено</span>
                      ) : (
                        <span className="badge-warning">На проверке</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={setOrgVerified}>
                        <input type="hidden" name="orgId" value={org.id} />
                        <input type="hidden" name="verified" value={org.verified ? "false" : "true"} />
                        <button className={org.verified ? "btn-secondary !px-4 !py-2 text-xs" : "btn-primary !px-4 !py-2 text-xs"}>
                          {org.verified ? "Снять проверку" : "Проверено"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
