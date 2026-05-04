import Link from "next/link";

export default function Home() {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold mb-3">Быстрый найм в отели</h1>
      <p className="text-gray-600 mb-10">Соискатели и работодатели находят друг друга за час, а не за неделю.</p>

      <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <Link href="/login?role=HR" className="card hover:border-brand-500 hover:shadow-sm transition">
          <div className="text-3xl mb-2">🏨</div>
          <h2 className="font-semibold text-lg mb-1">Я ищу сотрудников</h2>
          <p className="text-sm text-gray-600">Опубликуйте вакансию и нанимайте за минуты</p>
        </Link>
        <Link href="/login?role=WORKER" className="card hover:border-brand-500 hover:shadow-sm transition">
          <div className="text-3xl mb-2">👤</div>
          <h2 className="font-semibold text-lg mb-1">Я ищу работу</h2>
          <p className="text-sm text-gray-600">Найдите смену или постоянку рядом с домом</p>
        </Link>
      </div>
    </div>
  );
}
