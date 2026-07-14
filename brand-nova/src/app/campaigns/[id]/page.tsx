"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import AnalyticsSection from "@/components/analytics/AnalyticsSection";
import type { Campaign } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("nl-NL");

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [assigned, setAssigned] = useState<number>(0);
  const [pool, setPool] = useState<number | null>(null);
  const [count, setCount] = useState(500);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [detail, list] = await Promise.all([
      fetch(`/api/campaigns/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/campaigns").then((r) => (r.ok ? r.json() : null)),
    ]);
    if (detail?.campaign) setCampaign(detail.campaign);
    if (list) {
      setPool(list.pool ?? 0);
      const row = (list.campaigns ?? []).find(
        (c: { campaignId: string; assigned: number }) => c.campaignId === id
      );
      if (row) setAssigned(row.assigned);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function assign() {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setFlash(`${d.assigned} leads toegewezen.`);
      setTimeout(() => setFlash(null), 3000);
      load();
    }
  }

  async function setStatus(status: Campaign["status"]) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const field =
    "w-28 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm outline-none transition-colors focus:border-nova";

  return (
    <Shell>
      <div className="space-y-5">
        <Link href="/campaigns" className="text-xs text-ink-3 hover:text-ink">
          ← Alle campagnes
        </Link>

        <section className="glass p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{campaign?.name ?? "…"}</h1>
              {campaign?.description && (
                <p className="mt-1 max-w-xl text-sm text-ink-2">{campaign.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                <span>{fmt(assigned)} leads toegewezen</span>
                <span>·</span>
                <span>{campaign?.tracking_enabled ? "tracking aan" : "tracking uit"}</span>
                <span>·</span>
                <span>status: {campaign?.status}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {campaign?.status === "active" ? (
                <button
                  onClick={() => setStatus("paused")}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 hover:text-ink"
                >
                  Pauzeren
                </button>
              ) : (
                <button
                  onClick={() => setStatus("active")}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 hover:text-ink"
                >
                  Activeren
                </button>
              )}
            </div>
          </div>

          {/* Assign from pool */}
          <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-ink-3">
                Leads toewijzen uit de pool
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                />
                <button
                  onClick={assign}
                  disabled={busy}
                  className="rounded-lg bg-nova px-4 py-2 text-sm font-medium text-void transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Toewijzen
                </button>
                {pool !== null && (
                  <span className="text-xs text-ink-3">{fmt(pool)} beschikbaar</span>
                )}
                {flash && <span className="text-xs text-good">{flash}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Scoped analytics */}
        <AnalyticsSection campaignId={id} scoped />
      </div>
    </Shell>
  );
}
