import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "HoReCaGo — быстрый найм в отели",
  description: "Сервис для найма линейного персонала в HoReCa",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="ru">
      <body>
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg text-brand-700">
              HoReCaGo
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user?.role === "WORKER" && (
                <>
                  <Link href="/feed" className="hover:text-brand-600">Лента</Link>
                  <Link href="/applications" className="hover:text-brand-600">Мои отклики</Link>
                  <Link href="/profile" className="hover:text-brand-600">Профиль</Link>
                </>
              )}
              {user?.role === "HR" && (
                <>
                  <Link href="/hr" className="hover:text-brand-600">Дашборд</Link>
                  <Link href="/hr/vacancies/new" className="hover:text-brand-600">+ Вакансия</Link>
                </>
              )}
              {user ? (
                <form action="/api/auth/logout" method="post">
                  <button className="text-gray-500 hover:text-gray-900">Выйти</button>
                </form>
              ) : (
                <Link href="/login" className="btn-secondary !py-1.5 text-sm">Войти</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
