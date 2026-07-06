"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-sm p-8 text-center">
        <span className="orb mx-auto mb-5 block" aria-hidden />
        <h1 className="text-lg font-semibold">Brand Nova</h1>
        <p className="mt-1 text-sm text-ink-3">Je AI-medewerker wacht op je.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Wachtwoord"
          autoFocus
          className="mt-6 w-full rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-sm outline-none transition-colors focus:border-nova"
        />
        {error && (
          <p className="mt-2 text-xs text-warm">Dat wachtwoord klopt niet.</p>
        )}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-4 w-full rounded-lg bg-nova py-2.5 text-sm font-medium text-void transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Even kijken…" : "Binnenkomen"}
        </button>
      </form>
    </main>
  );
}
