"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Overzicht" },
  { href: "/mails", label: "Mails" },
  { href: "/leads", label: "Leads" },
  { href: "/import", label: "Import" },
  { href: "/settings", label: "Instellingen" },
];

/** Minimal top bar: wordmark, four links, logout. Nothing else. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="orb" aria-hidden />
          <span className="text-sm font-semibold tracking-wide text-ink">
            Brand&nbsp;Nova
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3.5 py-1.5 transition-colors ${
                pathname === item.href
                  ? "bg-nova-soft/60 text-ink"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={logout}
            className="ml-2 rounded-full px-3.5 py-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            Uitloggen
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
