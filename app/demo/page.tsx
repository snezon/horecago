import { prisma } from "@/lib/db";
import { Building2, UserRound, ArrowRight } from "lucide-react";
import DemoLoginButton from "./DemoLoginButton";

const DEMO_DOMAIN = "demo.horecago.test";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    include: {
      hrProfile: true,
      workerProfile: { include: { skills: { include: { position: true } } } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const hrs = users.filter((u) => u.role === "HR");
  const workers = users.filter((u) => u.role === "WORKER");

  if (users.length === 0) {
    return (
      <div className="card max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-semibold mb-2">Демо-данные не загружены</h1>
        <p className="text-ink-500 text-sm">Запустите <code>npx tsx prisma/seed-demo.ts</code> на сервере.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-50 border border-accent-200/50 text-xs font-medium text-accent-700 mb-4">
          Демо-режим
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Войти как демо-аккаунт</h1>
        <p className="text-ink-500">Один клик — и вы в системе. Никаких писем, паролей и регистрации.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-ink-500" />
          <h2 className="section-title">Работодатели</h2>
        </div>
        <ul className="grid sm:grid-cols-3 gap-4">
          {hrs.map((u) => (
            <li key={u.id} className="card flex flex-col">
              <div className="flex-1">
                <div className="text-xs text-ink-500 mb-1">{u.name}</div>
                <div className="font-semibold text-ink-900 mb-1">{u.hrProfile?.hotelName}</div>
                <div className="text-xs text-ink-500">{u.hrProfile?.address}</div>
              </div>
              <DemoLoginButton email={u.email} role="HR" />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <UserRound className="w-4 h-4 text-ink-500" />
          <h2 className="section-title">Соискатели</h2>
        </div>
        <ul className="grid sm:grid-cols-2 gap-3">
          {workers.map((u) => {
            const skills = u.workerProfile?.skills.map((s) => s.position.name) ?? [];
            return (
              <li key={u.id} className="card !p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink-900 truncate">{u.name}</div>
                  <div className="text-xs text-ink-500 truncate">
                    {skills.slice(0, 2).join(" · ") || "—"}
                  </div>
                </div>
                <DemoLoginButton email={u.email} role="WORKER" compact />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="card bg-ink-900 text-white border-ink-800 text-center">
        <p className="text-sm text-ink-300 mb-1">Хочешь начать с пустого аккаунта?</p>
        <a href="/login" className="inline-flex items-center gap-1.5 font-medium hover:gap-2.5 transition-all">
          Обычный вход <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
