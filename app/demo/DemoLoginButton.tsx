"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export default function DemoLoginButton({
  email,
  role,
  compact,
}: {
  email: string;
  role: "HR" | "WORKER";
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    const res = await fetch("/api/demo/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setLoading(false);
      alert("Ошибка входа");
      return;
    }
    const j = await res.json();
    window.location.href = j.role === "HR" ? "/hr" : "/applications";
  }

  return (
    <button
      onClick={login}
      disabled={loading}
      className={compact ? "btn-secondary !py-2 !px-3 shrink-0" : "btn-primary mt-4 w-full"}
    >
      {loading ? "..." : "Войти"}
      {!compact && <ArrowRight className="w-4 h-4" />}
    </button>
  );
}
