"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import type { CampaignStatRow } from "@/lib/analytics";

const fmt = (n: number) => n.toLocaleString("nl-NL");

const STATUS_STYLE: Record<string, string> = {
  active: "bg-good/15 text-good",
  paused: "bg-warm/15 text-warm",
  draft: "bg-ink-3/15 text-ink-2",
  completed: "bg-nova/15 text-nova",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignStatRow[] | null>(null);
  const [pool, setPool] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tracking, setTracking] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    if (res.ok) {
      const d = await res.json();
      setCampaigns(d.campaigns ?? []);
      setPool(d.pool ?? 0);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (name.trim().length < 2) return;
    setBusy(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description, trackingEnabled: tracking }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setDescription("");
      setCreating(false);
      load();
    }
  }

  const field =
    "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm outline-none transition-colors focus:border-nova";

  return (
    <Shell>
      <div className="space-y-5">
        {/* Lead pool + create */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="glass p-6 sm:col-span-1">
            <p className="text-xs uppercase tracking-wider text-ink-3">Lead Pool</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums text-ink">{fmt(pool)}</p>
            <p className="mt-2 text-xs text-ink-3">beschikbare leads, nog niet toegewezen</p>
          </div>
          <div className="glass flex flex-col justify-between p-6 sm:col-span-2">
            {creating ? (
              <div className="space-y-3">
                <input
                  className={field}
                  placeholder="Campagnenaam (bv. Website Check Juli)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <input
                  className={field}
                  placeholder="Korte omschrijving (optioneel)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    checked={tracking}
                    onChange={(e) => setTracking(e.target.checked)}
                    className="h-4 w-4 accent-[#7c8cff]"
                  />
                  Open- en klik-tracking aanzetten voor deze campagne
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={create}
                    disabled={busy || name.trim().length < 2}
                    className="rounded-lg bg-nova px-4 py-2 text-sm font-medium text-void transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Campagne aanmaken
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="text-sm text-ink-3 hover:text-ink"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-start justify-center">
                <h2 className="text-base font-semibold">Campagnes</h2>
                <p className="mt-1 max-w-md text-sm text-ink-2">
                  Groepeer leads in campagnes, wijs er een aantal aan toe vanuit de
                  pool, en vergelijk welke het beste presteert.
                </p>
                <button
                  onClick={() => setCreating(true)}
                  className="mt-4 rounded-lg bg-nova px-4 py-2 text-sm font-medium text-void transition-opacity hover:opacity-90"
                >
                  + Nieuwe campagne
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Campaign comparison table */}
        <section className="glass overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                  <th className="px-5 py-3 font-medium">Campagne</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Toegewezen</th>
                  <th className="px-3 py-3 text-right font-medium">Verstuurd</th>
                  <th className="px-3 py-3 text-right font-medium">Afgeleverd</th>
                  <th className="px-3 py-3 text-right font-medium">Open</th>
                  <th className="px-3 py-3 text-right font-medium">Klik</th>
                  <th className="px-3 py-3 text-right font-medium">Bounce</th>
                  <th className="px-5 py-3 text-right font-medium">Open rate</th>
                </tr>
              </thead>
              <tbody>
                {campaigns?.map((c) => (
                  <tr
                    key={c.campaignId}
                    className="group border-b border-line/60 last:border-0 transition-colors hover:bg-panel-2/50"
                  >
                    <td className="px-5 py-3">
                      <Link href={`/campaigns/${c.campaignId}`} className="block">
                        <span className="font-medium text-ink group-hover:text-nova">
                          {c.name}
                        </span>
                        {!c.trackingEnabled && (
                          <span className="ml-2 text-[11px] text-ink-3">geen tracking</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          STATUS_STYLE[c.status] ?? STATUS_STYLE.draft
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-2">{fmt(c.assigned)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-2">{fmt(c.sent)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-2">{fmt(c.delivered)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-nova">{fmt(c.opened)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-good">{fmt(c.clicked)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-2">{fmt(c.bounced)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">
                      {c.openRate}%
                    </td>
                  </tr>
                ))}
                {campaigns?.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-ink-3">
                      Nog geen campagnes. Maak er één aan en wijs leads toe uit de pool.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!campaigns && (
            <div className="flex h-24 items-center justify-center text-ink-3">
              <span className="dots">
                <span>●</span> <span>●</span> <span>●</span>
              </span>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
