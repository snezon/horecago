"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
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
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-bold text-ink-900 mb-2">Что-то пошло не так</h1>
      <p className="text-ink-500 mb-6">Мы уже знаем о проблеме. Попробуйте обновить страницу.</p>
      <button onClick={() => reset()} className="btn-primary">
        Обновить
      </button>
    </div>
  );
}
