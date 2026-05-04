import Link from "next/link";
import { ArrowRight, Building2, UserRound, Clock, ShieldCheck, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative -mt-10 pt-16 pb-12 bg-hero-radial">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-ink-200 text-xs font-medium text-ink-700 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent-500" />
            Найм за час, а не за неделю
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-ink-900 mb-5 leading-[1.05]">
            Линейный персонал<br />
            <span className="text-ink-500">для вашего отеля</span>
          </h1>
          <p className="text-lg text-ink-600 max-w-xl mx-auto mb-10">
            Современная платформа для отелей, кафе и ресторанов: публикуйте смены и постоянку,
            нанимайте проверенных сотрудников в один клик.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?role=HR" className="btn-primary !px-6 !py-3 text-base">
              Я ищу сотрудников
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login?role=WORKER" className="btn-secondary !px-6 !py-3 text-base">
              Я ищу работу
            </Link>
          </div>
        </div>
      </section>

      {/* Role cards */}
      <section className="grid sm:grid-cols-2 gap-5">
        <RoleCard
          href="/login?role=HR"
          icon={<Building2 className="w-6 h-6" />}
          title="Работодателю"
          subtitle="Отели, рестораны, кофейни"
          bullets={[
            "Опубликуйте вакансию с числом мест",
            "Получайте отклики с документами",
            "Нанимайте одной кнопкой",
          ]}
          cta="Опубликовать вакансию"
        />
        <RoleCard
          href="/login?role=WORKER"
          icon={<UserRound className="w-6 h-6" />}
          title="Соискателю"
          subtitle="Горничные, бариста, официанты"
          bullets={[
            "Заполните профиль один раз",
            "Откликайтесь в один клик",
            "Узнавайте о найме сразу",
          ]}
          cta="Найти работу"
        />
      </section>

      {/* Value props */}
      <section className="grid sm:grid-cols-3 gap-5">
        <Feature
          icon={<Clock className="w-5 h-5 text-accent-500" />}
          title="Минуты, не недели"
          text="HR видит документы и контакты в отклике — нанимает одной кнопкой."
        />
        <Feature
          icon={<ShieldCheck className="w-5 h-5 text-accent-500" />}
          title="Только HoReCa"
          text="Справочник позиций, понятный отрасли: бариста, рунер, хостес, повар — без шума."
        />
        <Feature
          icon={<Sparkles className="w-5 h-5 text-accent-500" />}
          title="Просто и честно"
          text="Контакты обеих сторон сразу. Закрылась вакансия — отклик мягко завершается, без жёстких отказов."
        />
      </section>
    </div>
  );
}

function RoleCard({
  href, icon, title, subtitle, bullets, cta,
}: { href: string; icon: React.ReactNode; title: string; subtitle: string; bullets: string[]; cta: string; }) {
  return (
    <Link href={href} className="card-interactive group flex flex-col">
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
