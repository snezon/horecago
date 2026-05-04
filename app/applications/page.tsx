import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "На рассмотрении", cls: "bg-yellow-50 text-yellow-700" },
  HIRED: { text: "Нанят", cls: "bg-green-50 text-green-700" },
  REJECTED: { text: "Отклонён", cls: "bg-gray-100 text-gray-600" },
};

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=WORKER");
  if (user.role !== "WORKER") redirect("/");

  const apps = await prisma.application.findMany({
    where: { workerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      vacancy: {
        include: { position: true, hr: { include: { hrProfile: true } } },
      },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Мои отклики</h1>
      {apps.length === 0 ? (
        <div className="card text-center text-gray-500">
          Откликов нет. <Link href="/feed" className="text-brand-600">Открыть ленту</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {apps.map((a) => {
            const isClosed = a.vacancy.status === "CLOSED";
            const showStatus = a.status === "PENDING" && isClosed
              ? { text: "Вакансия закрыта", cls: "bg-gray-100 text-gray-600" }
              : STATUS_LABEL[a.status];
            return (
              <li key={a.id}>
                <Link href={`/vacancy/${a.vacancy.id}`} className="card block hover:border-brand-500">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{a.vacancy.title}</div>
                      <div className="text-sm text-gray-600">
                        {a.vacancy.position.name} · {a.vacancy.hr.hrProfile?.hotelName}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${showStatus.cls}`}>{showStatus.text}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
