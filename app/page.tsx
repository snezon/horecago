import Link from "next/link";
import {
  ArrowRight, Building2, UserRound, Clock, ShieldCheck, Sparkles,
  MapPin, Wallet, Calendar, Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { shiftLabel, formatRub } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function Home() {
  const previewShifts = await prisma.shift.findMany({
    where: { status: "OPEN", shiftEnd: { gte: new Date() } },
    orderBy: { shiftStart: "asc" },
    include: { position: true, hr: { include: { hrProfile: true } } },
    take: 6,
  });

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative -mt-10 pt-16 pb-12 bg-hero-radial">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-ink-200 text-xs font-medium text-ink-700 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent-500" />
            Найм на смену за минуты
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-ink-900 mb-5 leading-[1.05]">
            Смены и подработка<br />
            <span className="text-ink-500">в отелях и ресторанах</span>
          </h1>
          <p className="text-lg text-ink-600 max-w-xl mx-auto mb-10">
            Uber для HoReCa-найма: HR публикует смену, кандидаты берут её в один клик.
            Закрытие позиции — за час.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?role=HR" className="btn-primary !px-6 !py-3 text-base">
              Опубликовать смену
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/feed" className="btn-secondary !px-6 !py-3 text-base">
              Найти подработку
            </Link>
          </div>
        </div>
      </section>

      {/* Shifts preview */}
      {previewShifts.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-1">Свежие смены</h2>
              <p className="text-sm text-ink-500">Открытые позиции, которые ждут кандидатов прямо сейчас</p>
            </div>
            <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900 hover:gap-2.5 transition-all">
              Смотреть все
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewShifts.map((s) => {
              const slotsLeft = s.headcount - s.hiredCount;
              return (
                <li key={s.id}>
                  <Link href={`/shift/${s.id}`} className="card-interactive block h-full cursor-pointer">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="badge-neutral">{s.position.name}</span>
                      <span className="badge-warning"><Users className="w-3 h-3" /> {slotsLeft}</span>
                    </div>
                    <h3 className="font-semibold text-ink-900 leading-snug mb-3 line-clamp-2">{s.title}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-ink-900 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-accent-500 shrink-0" />
                        {shiftLabel(s.shiftStart, s.shiftEnd)}
                      </div>
                      <div className="flex items-center gap-2 text-ink-900 font-semibold">
                        <Wallet className="w-3.5 h-3.5 text-accent-500 shrink-0" />
                        {formatRub(s.payment)} ₽
                      </div>
                      <div className="flex items-center gap-2 text-ink-700 pt-1">
                        <Building2 className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                        <span className="truncate">{s.hr.hrProfile?.hotelName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink-500">
                        <MapPin className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid sm:grid-cols-2 gap-5">
        <RoleCard
          href="/login?role=HR"
          icon={<Building2 className="w-6 h-6" />}
          title="Работодателю"
          subtitle="Отели, рестораны, кофейни"
          bullets={[
            "Опубликуйте смену с датой и ценой",
            "Получайте заявки с документами",
            "Подтверждайте одной кнопкой",
          ]}
          cta="Опубликовать смену"
        />
        <RoleCard
          href="/login?role=WORKER"
          icon={<UserRound className="w-6 h-6" />}
          title="Соискателю"
          subtitle="Подработка и постоянка"
          bullets={[
            "Заполните профиль один раз",
            "Берите смены в один клик",
            "Узнавайте о подтверждении сразу",
          ]}
          cta="Найти смену"
        />
      </section>

      <section className="grid sm:grid-cols-3 gap-5">
        <Feature
          icon={<Clock className="w-5 h-5 text-accent-500" />}
          title="Минуты, не недели"
          text="HR видит документы и контакты в заявке — подтверждает одной кнопкой."
        />
        <Feature
          icon={<ShieldCheck className="w-5 h-5 text-accent-500" />}
          title="Только HoReCa"
          text="Справочник позиций, понятный отрасли: бариста, рунер, хостес, повар."
        />
        <Feature
          icon={<Sparkles className="w-5 h-5 text-accent-500" />}
          title="Прозрачно"
          text="Оплата за смену, точные даты и время. Контакты сразу после заявки."
        />
      </section>
    </div>
  );
}

function RoleCard({
  href, icon, title, subtitle, bullets, cta,
}: { href: string; icon: React.ReactNode; title: string; subtitle: string; bullets: string[]; cta: string }) {
  return (
    <Link href={href} className="card-interactive group flex flex-col cursor-pointer">
      <div className="flex items-center gap-3 mb-1">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-ink-900 text-accent-400">
          {icon}
        </span>
        <div>
          <div className="text-lg font-semibold text-ink-900">{title}</div>
          <div className="text-sm text-ink-500">{subtitle}</div>
        </div>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-ink-700">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-accent-500 shrink-0" />
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-900 group-hover:gap-2.5 transition-all">
        {cta}
        <ArrowRight className="w-4 h-4" />
      </div>
    </Link>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-ink-200/70">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-semibold text-ink-900">{title}</h3>
      </div>
      <p className="text-sm text-ink-600 leading-relaxed">{text}</p>
    </div>
  );
}
