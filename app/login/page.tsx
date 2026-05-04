"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

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
      <div className="max-w-md mx-auto card">
        <h1 className="text-xl font-semibold mb-2">Ссылка отправлена</h1>
        <p className="text-sm text-gray-600 mb-4">
          Проверьте почту <b>{email}</b> и перейдите по ссылке для входа.
        </p>
        {sent.url && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs">
            <div className="font-medium text-yellow-800 mb-1">DEV: магическая ссылка</div>
            <a href={sent.url} className="text-blue-600 underline break-all">{sent.url}</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto card">
      <h1 className="text-xl font-semibold mb-1">Вход</h1>
      <p className="text-sm text-gray-600 mb-5">
        {role === "HR" && "Регистрация работодателя. "}
        {role === "WORKER" && "Регистрация соискателя. "}
        Введите email — мы пришлём ссылку для входа.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Отправка..." : "Получить ссылку"}
        </button>
      </form>
    </div>
  );
}
