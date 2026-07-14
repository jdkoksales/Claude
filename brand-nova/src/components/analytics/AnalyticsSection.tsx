"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Donut, Funnel, TrendChart } from "./Charts";
import type { Analytics, CampaignStatRow, TrendPoint } from "@/lib/analytics";

interface AnalyticsPayload {
  overall: Analytics;
  trend: TrendPoint[];
  pool: number;
  campaigns: CampaignStatRow[];
}

type DrillMetric = "sent" | "delivered" | "opened" | "clicked" | "bounced";

interface DrillLead {
  leadId: string;
  company: string;
  email: string;
  status: string;
  openCount: number;
  clickCount: number;
  lastOpenAt: string | null;
}

const fmt = (n: number) => n.toLocaleString("nl-NL");

function relative(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "zojuist";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} uur`;
  return `${Math.round(h / 24)} d`;
}

// ---------------------------------------------------------------------------
// Drill-down drawer: the leads behind a clicked KPI.
// ---------------------------------------------------------------------------
const METRIC_TITLE: Record<DrillMetric, string> = {
  sent: "Verstuurd naar",
  delivered: "Afgeleverd bij",
  opened: "Geopend door",
  clicked: "Doorgeklikt door",
  bounced: "Gebounced",
};

function DrillModal({
  metric,
  campaignId,
  onClose,
}: {
  metric: DrillMetric;
  campaignId?: string | null;
  onClose: () => void;
}) {
  const [leads, setLeads] = useState<DrillLead[] | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ metric });
    if (campaignId) q.set("campaign", campaignId);
    fetch(`/api/analytics/leads?${q}`)
      .then((r) => (r.ok ? r.json() : { leads: [] }))
      .then((d) => setLeads(d.leads ?? []));
  }, [metric, campaignId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/70 p-4 backdrop-blur-sm sm:p-10"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "feed-in 0.35s cubic-bezier(0.2,0.7,0.3,1) both" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {METRIC_TITLE[metric]}{" "}
            {leads && <span className="text-ink-3">· {leads.length}</span>}
          </h3>
          <button onClick={onClose} className="text-ink-3 hover:text-ink">
            Sluiten
          </button>
        </div>
        {!leads ? (
          <div className="py-10 text-center text-ink-3">
            <span className="dots">
              <span>●</span> <span>●</span> <span>●</span>
            </span>
          </div>
        ) : leads.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-3">Nog niemand hier.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {leads.map((l) => (
              <li key={l.leadId}>
                <Link
                  href={`/leads/${l.leadId}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-panel-2/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{l.company}</p>
                    <p className="truncate text-xs text-ink-3">{l.email}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-3">
                    {metric === "opened" && (
                      <span>
                        {l.openCount}× · {relative(l.lastOpenAt)}
                      </span>
                    )}
                    {metric === "clicked" && <span>{l.clickCount}× geklikt</span>}
                    {(metric === "sent" || metric === "delivered") && (
                      <span>{l.openCount > 0 ? `${l.openCount}× geopend` : "nog niet geopend"}</span>
                    )}
                    {metric === "bounced" && <span className="text-warm">bounced</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card — clickable ones open the drill-down.
// ---------------------------------------------------------------------------
function Kpi({
  label,
  value,
  accent,
  onClick,
  href,
}: {
  label: string;
  value: string;
  accent?: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs uppercase tracking-wider text-ink-3">{label}</p>
      <p
        className="mt-2 text-2xl font-semibold tabular-nums"
        style={{ color: accent ?? "var(--color-ink)" }}
      >
        {value}
      </p>
      {(onClick || href) && (
        <span className="mt-2 inline-block text-[11px] text-ink-3 transition-colors group-hover:text-nova">
          Bekijk leads →
        </span>
      )}
    </>
  );
  const cls =
    "glass group p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-nova/40";
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

export default function AnalyticsSection({
  campaignId = null,
  scoped = false,
  selectable = false,
}: {
  campaignId?: string | null;
  scoped?: boolean;
  /** Show a Totaal / per-campaign picker (dashboard only). */
  selectable?: boolean;
}) {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [drill, setDrill] = useState<DrillMetric | null>(null);
  // The scope currently shown: null = Totaal. Fixed to campaignId when scoped.
  const [scope, setScope] = useState<string | null>(campaignId);
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);

  // Populate the picker once (dashboard only).
  useEffect(() => {
    if (!selectable) return;
    fetch("/api/campaigns")
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((d) =>
        setOptions(
          (d.campaigns ?? []).map((c: { campaignId: string; name: string }) => ({
            id: c.campaignId,
            name: c.name,
          }))
        )
      );
  }, [selectable]);

  const load = useCallback(async () => {
    const url = scope ? `/api/analytics?campaign=${scope}` : "/api/analytics";
    const res = await fetch(url);
    if (!res.ok) return;
    const d = await res.json();
    // Campaign-scoped responses omit pool/campaigns; normalize.
    setData({ pool: 0, campaigns: [], ...d });
  }, [scope]);

  useEffect(() => {
    setData(null);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const isTotal = scope === null;

  const selector = selectable ? (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-ink-3">Weergave</span>
      <select
        value={scope ?? ""}
        onChange={(e) => setScope(e.target.value || null)}
        className="rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-nova"
      >
        <option value="">Totaal (alle campagnes)</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  if (!data) {
    return (
      <div className="space-y-4">
        {selector}
        <div className="glass flex h-40 items-center justify-center text-ink-3">
          <span className="dots text-lg">
            <span>●</span> <span>●</span> <span>●</span>
          </span>
        </div>
      </div>
    );
  }

  const a = data.overall;
  const activeCampaigns = data.campaigns.filter((c) => c.status === "active").length;

  const trendLabels = data.trend.map((p) =>
    new Date(p.day).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
  );

  return (
    <div className="space-y-5">
      {selector && (
        <div className="flex items-center justify-between">
          {selector}
          {!isTotal && (
            <Link
              href={`/campaigns/${scope}`}
              className="text-xs text-ink-3 hover:text-nova"
            >
              Open campagnepagina →
            </Link>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {isTotal && (
          <Kpi label="Leads in pool" value={fmt(data.pool)} href="/campaigns" />
        )}
        {isTotal && (
          <Kpi label="Actieve campagnes" value={fmt(activeCampaigns)} href="/campaigns" />
        )}
        <Kpi label="Verstuurd" value={fmt(a.sent)} onClick={() => setDrill("sent")} />
        <Kpi
          label="Afgeleverd"
          value={fmt(a.delivered)}
          onClick={() => setDrill("delivered")}
        />
        <Kpi
          label="Geopend"
          value={fmt(a.opened)}
          accent="#7c8cff"
          onClick={() => setDrill("opened")}
        />
        <Kpi
          label="Geklikt"
          value={fmt(a.clicked)}
          accent="#4ade80"
          onClick={() => setDrill("clicked")}
        />
        <Kpi
          label="Open rate"
          value={`${a.openRate}%`}
          accent="#7c8cff"
          onClick={() => setDrill("opened")}
        />
        <Kpi
          label="Bounces"
          value={fmt(a.bounced)}
          accent={a.bounced > 0 ? "#ff9d5c" : undefined}
          onClick={() => setDrill("bounced")}
        />
      </div>

      {/* Donuts + funnel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass flex items-center justify-around p-6 lg:col-span-2">
          <Donut value={a.openRate} label="Open rate" color="#7c8cff" sub={`${fmt(a.opened)} geopend`} />
          <Donut value={a.clickRate} label="Click rate" color="#4ade80" sub={`${fmt(a.clicked)} geklikt`} />
          <Donut value={a.bounceRate} label="Bounce rate" color="#ff9d5c" sub={`${fmt(a.bounced)} bounces`} />
        </section>
        <section className="glass p-6">
          <h3 className="mb-4 text-sm font-medium text-ink-2">Funnel</h3>
          <Funnel
            stages={[
              { label: "Verstuurd", value: a.sent, color: "#7c8cff" },
              { label: "Afgeleverd", value: a.delivered, color: "#8f7cff" },
              { label: "Geopend", value: a.opened, color: "#c08bff" },
              { label: "Geklikt", value: a.clicked, color: "#4ade80" },
            ]}
          />
        </section>
      </div>

      {/* Trend */}
      <section className="glass p-6">
        <h3 className="mb-4 text-sm font-medium text-ink-2">Activiteit over tijd</h3>
        <TrendChart
          labels={trendLabels}
          series={[
            {
              key: "sent",
              label: "Verstuurd",
              color: "#7c8cff",
              points: data.trend.map((p) => p.sent),
            },
            {
              key: "opened",
              label: "Geopend",
              color: "#c08bff",
              points: data.trend.map((p) => p.opened),
            },
            {
              key: "clicked",
              label: "Geklikt",
              color: "#4ade80",
              points: data.trend.map((p) => p.clicked),
            },
          ]}
        />
      </section>

      {drill && (
        <DrillModal metric={drill} campaignId={scope} onClose={() => setDrill(null)} />
      )}
    </div>
  );
}
