import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { applyToVacancy } from "./actions";

export default async function VacancyPage({ params }: { params: { id: string } }) {
  const vacancy = await prisma.vacancy.findUnique({
    where: { id: params.id },
    include: { position: true, hr: { include: { hrProfile: true } } },
  });
  if (!vacancy) notFound();

  const user = await getCurrentUser();
  const myApp = user
    ? await prisma.application.findUnique({
        where: { vacancyId_workerId: { vacancyId: vacancy.id, workerId: user.id } },
      })
    : null;

  const slotsLeft = vacancy.headcount - vacancy.hiredCount;
  const isClosed = vacancy.status === "CLOSED";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/feed" className="text-sm text-gray-500 hover:text-gray-900">← К ленте</Link>

      <div className="card">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-semibold">{vacancy.title}</h1>
          {isClosed ? (
            <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">Вакансия закрыта</span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-brand-50 text-brand-700 rounded">{slotsLeft} мест</span>
          )}
        </div>
        <div className="text-sm text-gray-600 mb-4">
          {vacancy.position.name} · {vacancy.hr.hrProfile?.hotelName}
        </div>

        <div className="space-y-3 text-sm">
          {vacancy.salary && (
            <div><span className="text-gray-500">Зарплата:</span> <b>{vacancy.salary}</b></div>
          )}
          <div><span className="text-gray-500">Адрес:</span> {vacancy.address}</div>
        </div>

        <div className="prose prose-sm max-w-none mt-4 whitespace-pre-wrap">
          {vacancy.description}
        </div>
      </div>

      {myApp ? (
        <div className="card">
          {myApp.status === "PENDING" && !isClosed && (
            <div className="text-sm">
              <div className="font-medium mb-1">Вы откликнулись</div>
              <div className="text-gray-600">Ждите ответа работодателя. Контакты:</div>
              <div className="mt-2">
                📞 {vacancy.hr.phone} · ✉️ {vacancy.hr.email}
              </div>
            </div>
          )}
          {myApp.status === "PENDING" && isClosed && (
            <div className="text-sm text-gray-600">
              Вакансия закрыта — все места набраны. Попробуйте другие предложения в <Link href="/feed" className="text-brand-600">ленте</Link>.
            </div>
          )}
          {myApp.status === "HIRED" && (
            <div className="text-sm">
              <div className="font-medium text-green-700 mb-1">Вы наняты! 🎉</div>
              <div className="text-gray-600">Свяжитесь с работодателем:</div>
              <div className="mt-2">
                📞 {vacancy.hr.phone} · ✉️ {vacancy.hr.email}
              </div>
            </div>
          )}
          {myApp.status === "REJECTED" && (
            <div className="text-sm text-gray-600">К сожалению, работодатель отклонил ваш отклик.</div>
          )}
        </div>
      ) : !user ? (
        <Link href={`/login?role=WORKER`} className="btn-primary block text-center">
          Войти и откликнуться
        </Link>
      ) : user.role !== "WORKER" ? (
        <div className="card text-sm text-gray-500">
          Откликаться могут только соискатели.
        </div>
      ) : isClosed ? (
        <div className="card text-sm text-gray-500">Вакансия закрыта</div>
      ) : (
        <form action={applyToVacancy}>
          <input type="hidden" name="vacancyId" value={vacancy.id} />
          <button className="btn-primary w-full">Откликнуться</button>
        </form>
      )}
    </div>
  );
}
