import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { LogOut, LayoutDashboard, Plus, ListChecks, User, Newspaper } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HoReCaGo — быстрый найм в отели",
  description: "Сервис найма линейного персонала в HoReCa за минуты, не недели.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200/70">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ink-900 text-accent-400 text-sm font-bold">H</span>
              <span className="text-base">HoReCaGo</span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2 text-sm">
              {user?.role === "WORKER" && (
                <>
                  <NavLink href="/feed" icon={<Newspaper className="w-4 h-4" />} label="Лента" />
                  <NavLink href="/applications" icon={<ListChecks className="w-4 h-4" />} label="Отклики" />
                  <NavLink href="/profile" icon={<User className="w-4 h-4" />} label="Профиль" />
                </>
              )}
              {user?.role === "HR" && (
                <>
                  <NavLink href="/hr" icon={<LayoutDashboard className="w-4 h-4" />} label="Дашборд" />
                  <Link href="/hr/vacancies/new" className="btn-accent !py-2 !px-3">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Вакансия</span>
                  </Link>
                </>
              )}
              {user ? (
                <form action="/api/auth/logout" method="post">
                  <button className="btn-ghost !py-2 !px-2" title="Выйти">
                    <LogOut className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/login?role=HR" className="btn-ghost !py-2 hidden sm:inline-flex">
                    Опубликовать вакансию
                  </Link>
                  <Link href="/login" className="btn-primary !py-2 text-sm">Войти</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-10">{children}</main>
        <footer className="border-t border-ink-200/70 mt-16 py-8 text-center text-xs text-ink-500">
          © {new Date().getFullYear()} HoReCaGo · Найм в индустрии гостеприимства
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="btn-ghost !py-2 !px-3 hidden sm:inline-flex">
      {icon}
      <span>{label}</span>
    </Link>
  );
}
