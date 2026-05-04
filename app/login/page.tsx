"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const params = useSearchParams();
  const role = params.get("role") === "HR" ? "HR" : params.get("role") === "WORKER" ? "WORKER" : null;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ url?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Ошибка");
      return;
    }
    const j = await res.json();
    setSent({ url: j.url });
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> На главную
        </Link>
        <div className="card text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Ссылка отправлена</h1>
          <p className="text-sm text-ink-600 mb-1">Проверьте почту</p>
          <p className="text-sm font-medium text-ink-900 mb-6">{email}</p>
          <p className="text-xs text-ink-500">Ссылка действительна 15 минут.</p>
          {sent.url && (
            <div className="mt-5 p-3 rounded-lg bg-accent-50 border border-accent-200/50 text-left">
              <div className="text-xs font-semibold text-accent-700 mb-1">DEV: магическая ссылка</div>
              <a href={sent.url} className="text-xs text-ink-700 underline break-all">{sent.url}</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> На главную
      </Link>
      <div className="card">
        <h1 className="text-2xl font-semibold mb-2">
          {role === "HR" ? "Вход для работодателя" : role === "WORKER" ? "Вход для соискателя" : "Вход"}
        </h1>
        <p className="text-sm text-ink-600 mb-6">
          Введите email — пришлём ссылку для входа. Без паролей.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="email"
                className="input pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoFocus
              />
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button className="btn-primary w-full !py-3" disabled={loading}>
            {loading ? "Отправка..." : "Получить ссылку"}
          </button>
        </form>
      </div>
    </div>
  );
}
