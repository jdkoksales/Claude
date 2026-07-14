"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityEntry, ActivityType } from "@/lib/types";
import type { BriefingStats } from "@/lib/stats";
import AnalyticsSection from "./analytics/AnalyticsSection";

const POLL_MS = 4000;
const MAX_FEED = 60;

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/** Animated count-up so live counters feel alive without being noisy. */
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let frame: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  return `${Math.round(hours / 24)} dagen geleden`;
}

const TYPE_STYLE: Record<ActivityType, { dot: string; label: string }> = {
  analyzing: { dot: "bg-nova", label: "analyse" },
  writing: { dot: "bg-nova", label: "schrijven" },
  sending: { dot: "bg-good", label: "versturen" },
  reading: { dot: "bg-warm", label: "lezen" },
  learning: { dot: "bg-nova", label: "leren" },
  followup: { dot: "bg-good", label: "follow-up" },
  warm_lead: { dot: "bg-warm", label: "warme lead" },
  import: { dot: "bg-ink-3", label: "import" },
  system: { dot: "bg-ink-3", label: "systeem" },
  waiting: { dot: "bg-ink-3", label: "wachten" },
  opened: { dot: "bg-nova", label: "geopend" },
  clicked: { dot: "bg-good", label: "geklikt" },
};

function greeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 6) return `Nog wakker, ${name}?`;
  if (hour < 12) return `Goedemorgen, ${name}.`;
  if (hour < 18) return `Goedemiddag, ${name}.`;
  return `Goedenavond, ${name}.`;
}

// ---------------------------------------------------------------------------
// Attention inbox (replies the AI deliberately didn't answer)
// ---------------------------------------------------------------------------

interface AttentionReply {
  id: string;
  subject: string | null;
  raw_body: string;
  received_at: string;
  classification: string | null;
  bn_leads: { bn_companies: { name: string; email: string } };
}

function AttentionList({ onHandled }: { onHandled: () => void }) {
  const [replies, setReplies] = useState<AttentionReply[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/attention");
    if (res.ok) {
      const data = await res.json();
      setReplies(data.replies ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS * 5);
    return () => clearInterval(timer);
  }, [load]);

  async function markHandled(id: string) {
    await fetch(`/api/replies/${id}`, { method: "PATCH" });
    setReplies((prev) => prev.filter((r) => r.id !== id));
    onHandled();
  }

  if (replies.length === 0) return null;

  return (
    <section className="glass p-5">
      <h2 className="mb-3 text-sm font-medium text-warm">
        Heeft jouw blik nodig ({replies.length})
      </h2>
      <ul className="space-y-3">
        {replies.map((reply) => {
          const company = reply.bn_leads?.bn_companies;
          return (
            <li key={reply.id} className="rounded-lg border border-line bg-panel-2/60 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <button
                  className="text-left text-sm font-medium text-ink hover:text-nova"
                  onClick={() => setOpen(open === reply.id ? null : reply.id)}
                >
                  {company?.name ?? "Onbekend bedrijf"}
                </button>
                <span className="shrink-0 text-xs text-ink-3">
                  {relativeTime(reply.received_at)}
                </span>
              </div>
              {open === reply.id && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">
                  {reply.raw_body.slice(0, 1200)}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {company?.email && (
                  <a
                    className="text-nova hover:underline"
                    href={`mailto:${company.email}?subject=${encodeURIComponent(
                      reply.subject?.startsWith("Re:")
                        ? reply.subject
                        : `Re: ${reply.subject ?? ""}`
                    )}`}
                  >
                    Beantwoord zelf
                  </a>
                )}
                <button
                  className="text-ink-3 hover:text-ink"
                  onClick={() => markHandled(reply.id)}
                >
                  Afgehandeld
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Deliverability — the honest answer to "does this land in spam?": no one
// (not even Gmail) tells a sender per-message inbox-vs-spam placement. The
// real, measurable signal is the spam-complaint rate reported back through
// Resend's provider feedback loop. Industry rule of thumb: keep it under
// 0.1%; above 0.3% providers start throttling or blocking the domain.
// ---------------------------------------------------------------------------

function DeliverabilityCard({
  deliverability,
}: {
  deliverability: BriefingStats["deliverability"];
}) {
  const { sentLast7d, bouncedLast7d, complaintsLast7d, complaintRatePct } =
    deliverability;
  const level =
    complaintRatePct >= 0.3 ? "critical" : complaintRatePct >= 0.1 ? "warning" : "good";
  const levelText = {
    good: { label: "Gezond", className: "text-good" },
    warning: { label: "Let op", className: "text-warm" },
    critical: { label: "Risico", className: "text-warm" },
  }[level];

  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink-2">
          Verzendgezondheid (laatste 7 dagen)
        </h2>
        <span className={`text-xs font-medium ${levelText.className}`}>
          {levelText.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">Verstuurd</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {sentLast7d}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">Bounces</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {bouncedLast7d}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">
            Als spam gemarkeerd
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              complaintsLast7d > 0 ? "text-warm" : "text-ink"
            }`}
          >
            {complaintsLast7d}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        Niemand — ook Gmail niet — laat zien of een individuele mail in de
        inbox of spammap belandt. Dit is het enige harde signaal: hoeveel
        ontvangers 'm actief als spam markeerden. Bij 0 is er niets aan de
        hand; bij herhaalde klachten verlaag ik desgewenst het dagtempo
        verder.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The dashboard itself
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [stats, setStats] = useState<BriefingStats | null>(null);
  const [feed, setFeed] = useState<ActivityEntry[]>([]);
  const [briefing, setBriefing] = useState<string | null>(null);
  const lastIdRef = useRef<number | null>(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    fetch("/api/briefing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBriefing(d.text));
  }, []);

  const poll = useCallback(async () => {
    const after = firstLoadRef.current ? "" : `?after=${lastIdRef.current ?? ""}`;
    const res = await fetch(`/api/feed${after}`);
    if (!res.ok) return;
    const data: { entries: ActivityEntry[]; stats: BriefingStats } = await res.json();
    setStats(data.stats);
    if (data.entries.length > 0) {
      lastIdRef.current = data.entries[data.entries.length - 1].id;
      setFeed((prev) => {
        const merged = firstLoadRef.current
          ? data.entries
          : [...prev, ...data.entries];
        return merged.slice(-MAX_FEED);
      });
    }
    firstLoadRef.current = false;
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  async function togglePause() {
    if (!stats) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: !stats.paused }),
    });
    poll();
  }

  const warmToday = useCountUp(stats?.warmLeadsToday ?? 0);
  const warmTotal = useCountUp(stats?.warmLeadsTotal ?? 0);
  const sent24 = useCountUp(stats?.sentLast24h ?? 0);
  const analyzed24 = useCountUp(stats?.analyzedLast24h ?? 0);
  const queue = useCountUp(stats?.inQueue ?? 0);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-3">
        <span className="dots text-lg">
          <span>●</span> <span>●</span> <span>●</span>
        </span>
      </div>
    );
  }

  const goalPct = Math.min(
    100,
    Math.round((stats.warmLeadsToday / Math.max(1, stats.dailyGoal)) * 100)
  );

  return (
    <div className="space-y-5">
      {/* The AI's morning briefing — the first thing you read. Real numbers,
          phrased by the model; falls back to a short greeting until it loads. */}
      <section className="glass relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-nova/10 blur-3xl" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2.5">
              <span className={`orb ${stats.paused ? "paused" : ""}`} aria-hidden />
              <span className="text-xs uppercase tracking-wider text-ink-3">
                Briefing van je AI-medewerker
              </span>
            </div>
            {briefing ? (
              <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">
                {briefing}
              </p>
            ) : (
              <h1 className="text-xl font-semibold sm:text-2xl">
                {greeting(stats.userName)}
              </h1>
            )}
            {stats.currentTask && !stats.paused && (
              <p className="mt-4 flex items-center gap-2 text-sm">
                <span className="scanning">{stats.currentTask}</span>
                <span className="dots text-nova">
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                </span>
              </p>
            )}
          </div>
          <button
            onClick={togglePause}
            className="glass shrink-0 rounded-full px-4 py-2 text-xs text-ink-2 transition-colors hover:text-ink"
            title={stats.paused ? "AI hervatten" : "AI pauzeren"}
          >
            <span className="flex items-center gap-2">
              <span className={`orb ${stats.paused ? "paused" : ""}`} aria-hidden />
              {stats.paused ? "Gepauzeerd" : "Aan het werk"}
            </span>
          </button>
        </div>
      </section>

      {/* The analytics dashboard proper — KPIs, charts, funnel. */}
      <AnalyticsSection selectable />

      {/* The one KPI, plus supporting signals (deliberately smaller) */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="glass p-5 sm:col-span-1">
          <p className="text-xs uppercase tracking-wider text-ink-3">
            Warme leads vandaag
          </p>
          <p className="mt-1 text-5xl font-semibold tabular-nums text-ink">
            {warmToday}
            <span className="ml-2 text-lg font-normal text-ink-3">
              / {stats.dailyGoal}
            </span>
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="goalbar h-full rounded-full" style={{ width: `${goalPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {warmTotal} warme leads in totaal
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:col-span-2">
          {[
            { label: "E-mails (24u)", value: sent24 },
            { label: "Geanalyseerd (24u)", value: analyzed24 },
            { label: "In de wachtrij", value: queue },
          ].map((tile) => (
            <div key={tile.label} className="glass flex flex-col justify-between p-5">
              <p className="text-xs uppercase tracking-wider text-ink-3">
                {tile.label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {stats.deliverability.sentLast7d > 0 && (
        <DeliverabilityCard deliverability={stats.deliverability} />
      )}

      <AttentionList onHandled={poll} />

      {/* Live activity feed — the primary surface */}
      <section className="glass p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-medium text-ink-2">Live activiteit</h2>
        {feed.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">
            Nog geen activiteit. Importeer een CSV met leads en ik ga aan de slag.
          </p>
        ) : (
          <ul className="space-y-1">
            {[...feed].reverse().map((entry) => {
              const style = TYPE_STYLE[entry.type] ?? TYPE_STYLE.system;
              return (
                <li
                  key={entry.id}
                  className="feed-item flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-panel-2/60"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                    aria-hidden
                  />
                  <span className="flex-1 text-sm leading-relaxed text-ink-2">
                    {entry.message}
                  </span>
                  <span className="mt-0.5 shrink-0 text-xs tabular-nums text-ink-3">
                    {relativeTime(entry.occurred_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
