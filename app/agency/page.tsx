import { redirect } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agencyIdsOf } from "@/lib/domain/access";
import { MAX_INVITES_PER_BATCH } from "@/lib/domain/emails";
import { sendWorkerInvites } from "./actions";

type ConnectionState = "ACTIVE" | "REVOKED" | "PENDING" | "CANCELLED" | "EXPIRED";

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  ACTIVE: "Работает с вами",
  REVOKED: "Отозвано работником",
  PENDING: "Ждём подтверждения",
  CANCELLED: "Приглашение отменено",
  EXPIRED: "Приглашение просрочено",
};

const CONNECTION_BADGE: Record<ConnectionState, string> = {
  ACTIVE: "badge-neutral",
  REVOKED: "badge-muted",
  PENDING: "badge-warning",
  CANCELLED: "badge-muted",
  EXPIRED: "badge-muted",
};

// Представительство появляется, только когда человек уже зарегистрирован —
// для нового приглашённого его пока нет вовсе, поэтому статус связи бере́м
// из представительства, если оно есть, а иначе из самого приглашения.
function connectionState(
  repStatus: string | undefined,
  inviteStatus: string,
): ConnectionState {
  if (repStatus === "ACTIVE") return "ACTIVE";
  if (repStatus === "REVOKED") return "REVOKED";
  if (inviteStatus === "CANCELLED") return "CANCELLED";
  if (inviteStatus === "EXPIRED") return "EXPIRED";
  // PENDING (представительство или приглашение) и ACCEPTED без активного
  // представительства — во всех случаях ждём, когда человек подтвердит связь.
  return "PENDING";
}

const DELIVERY_ERROR_PREVIEW_MAX = 120;

// В подсказку выводим только начало текста ошибки: почтовый сервер может
// вернуть техническую внутренность (адрес, порт, стектрейс), полный текст
// уже есть в журнале сервера — на странице агентства он не нужен целиком.
function deliveryErrorPreview(raw: string | null): string {
  const text = raw ?? "неизвестная ошибка";
  return text.length > DELIVERY_ERROR_PREVIEW_MAX
    ? text.slice(0, DELIVERY_ERROR_PREVIEW_MAX)
    : text;
}

function parseCount(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default async function AgencyDashboardPage({
  searchParams,
}: {
  searchParams: { sent?: string; failed?: string; invalid?: string; skipped?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=AGENCY");
  if (user.role !== "AGENCY") redirect("/");

  const [agencyId] = await agencyIdsOf(user.id);
  if (!agencyId) redirect("/onboarding/agency");

  const org = await prisma.org.findUnique({ where: { id: agencyId } });
  if (!org) redirect("/onboarding/agency");

  // Список строим от приглашений, а не от представительств: представительство
  // заводится только для уже зарегистрированного человека, а основной сценарий
  // пилота — звать людей, которых в системе ещё нет. Для них строка должна
  // появиться сразу, до какой-либо регистрации.
  const invites = await prisma.agencyInvite.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const reps = await prisma.representation.findMany({
    where: { agencyId },
    include: { worker: true },
  });
  const repByEmail = new Map(reps.map((r) => [r.worker.email, r]));

  const sent = parseCount(searchParams.sent);
  const failed = parseCount(searchParams.failed);
  const invalid = parseCount(searchParams.invalid);
  const skipped = parseCount(searchParams.skipped);
  const hasSummary = sent + failed + invalid + skipped > 0;

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
        <h2 className="section-title">Пригласить работников</h2>
        {hasSummary && (
          <div className="text-sm rounded-lg bg-ink-50 border border-ink-100 px-4 py-3 space-y-0.5">
            {sent > 0 && <p className="text-emerald-700">Отправлено: {sent}</p>}
            {failed > 0 && <p className="text-red-600">Не удалось отправить: {failed}</p>}
            {invalid > 0 && (
              <p className="text-amber-700">Не похоже на адрес и пропущено: {invalid}</p>
            )}
            {skipped > 0 && (
              <p className="text-ink-600">
                Не поместилось в пачку (лимит {MAX_INVITES_PER_BATCH} за раз): {skipped}.
                Отправьте их следующим разом.
              </p>
            )}
          </div>
        )}
        <form action={sendWorkerInvites} className="space-y-3">
          <div>
            <label className="label">Адреса работников</label>
            <textarea
              name="emails"
              className="input min-h-[120px]"
              required
              placeholder={"ivan@example.com\nmaria@example.com"}
            />
            <p className="text-xs text-ink-500 mt-1">
              По одному адресу в строке, до {MAX_INVITES_PER_BATCH} за раз.
            </p>
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
        <h2 className="section-title mb-4">Приглашённые работники</h2>
        {invites.length === 0 ? (
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
                  <th className="px-4 py-3 font-medium">Письмо</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const rep = repByEmail.get(invite.email);
                  const state = connectionState(rep?.status, invite.status);
                  const deliveryFailed = invite.deliveryStatus === "FAILED";
                  const label = rep?.worker.name || rep?.worker.email || invite.email;
                  return (
                    <tr key={invite.id} className="border-b border-ink-100 last:border-0">
                      <td className="px-4 py-3 text-ink-900">{label}</td>
                      <td className="px-4 py-3">
                        <span className={CONNECTION_BADGE[state]}>
                          {CONNECTION_LABELS[state]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {deliveryFailed && (
                          <span
                            className="badge-warning cursor-help"
                            title={deliveryErrorPreview(invite.deliveryError)}
                          >
                            Письмо не доставлено
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-500">
                        {invite.createdAt.toLocaleDateString("ru-RU")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
