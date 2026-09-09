"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Попадает в системный журнал (journalctl / логи процесса).
    console.error(error);
  }, [error]);

  return (
    <html lang="ru">
      <body>
        <div className="max-w-md mx-auto py-16 text-center">
          <h1 className="text-2xl font-bold text-ink-900 mb-2">Что-то пошло не так</h1>
          <p className="text-ink-500 mb-6">Мы уже знаем о проблеме. Попробуйте обновить страницу.</p>
          <button onClick={() => reset()} className="btn-primary">
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
