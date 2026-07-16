"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import type { CallLead, CallOutcome, CallStatus } from "@/lib/calls";

const STATUS_LABEL: Record<CallStatus, string> = {
  todo: "Nog bellen",
  callback: "Terugbellen",
  reached: "Bereikt",
  done: "Afgehandeld",
  skip: "Niet bellen",
};

const STATUS_PILL: Record<CallStatus, string> = {
  todo: "bg-nova/15 text-nova",
  callback: "bg-warm/20 text-warm",
  reached: "bg-good/15 text-good",
  done: "bg-ink-3/20 text-ink-2",
  skip: "bg-ink-3/10 text-ink-3",
};

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  answered: "Opgenomen",
  no_answer: "Geen gehoor",
  voicemail: "Voicemail",
  callback: "Terugbellen",
  interested: "Interesse",
  not_interested: "Geen interesse",
  converted: "Klant geworden",
  wrong_number: "Verkeerd nummer",
};

// Quick-log buttons, in the order they're most used on a call round.
const OUTCOME_BUTTONS: { outcome: CallOutcome; accent?: string }[] = [
  { outcome: "answered" },
  { outcome: "no_answer" },
  { outcome: "voicemail" },
  { outcome: "callback", accent: "text-warm" },
  { outcome: "interested", accent: "text-good" },
  { outcome: "not_interested" },
  { outcome: "converted", accent: "text-good" },
  { outcome: "wrong_number" },
];

type EngagementFilter = "all" | "clicked" | "opened";

function relative(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "zojuist";
  if (m < 60) return `${m} min geleden`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} uur geleden`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "dag" : "dagen"} geleden`;
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BellenPage() {
  const [leads, setLeads] = useState<CallLead[] | null>(null);
  const [engagement, setEngagement] = useState<EngagementFilter>("all");
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/calls");
    if (res.ok) setLeads((await res.json()).leads ?? []);
  }, []);

  useEffect(() => {
    load();
    // Fast poll: the Bel-nu-signaal is about minutes, not quarters of an hour.
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function log(leadId: string, outcome: CallOutcome) {
    setBusy(true);
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId, outcome, note }),
    });
    setBusy(false);
    if (res.ok) {
      setNote("");
      load();
    }
  }

  async function setStatus(leadId: string, callStatus: CallStatus) {
    // Optimistic update so the dropdown feels instant.
    setLeads((prev) =>
      prev ? prev.map((l) => (l.leadId === leadId ? { ...l, callStatus } : l)) : prev
    );
    await fetch("/api/calls", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId, callStatus }),
    });
  }

  const filtered = useMemo(() => {
    if (!leads) return null;
    return leads.filter((l) => {
      if (engagement === "clicked" && l.clickCount === 0) return false;
      if (engagement === "opened" && l.clickCount > 0) return false;
      if (statusFilter !== "all" && l.callStatus !== statusFilter) return false;
      return true;
    });
  }, [leads, engagement, statusFilter]);

  const counts = useMemo(() => {
    const c = { todo: 0, callback: 0, reached: 0 };
    for (const l of leads ?? []) {
      if (l.callStatus === "todo") c.todo++;
      else if (l.callStatus === "callback") c.callback++;
      else if (l.callStatus === "reached") c.reached++;
    }
    return c;
  }, [leads]);

  // 🔥 Nu actief: engaged within the last 30 minutes and still callable —
  // these are the "call within 5 minutes" opportunities.
  const hot = useMemo(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    return (leads ?? []).filter((l) => {
      if (l.callStatus === "done" || l.callStatus === "skip") return false;
      const t = Math.max(
        l.lastOpenAt ? new Date(l.lastOpenAt).getTime() : 0,
        l.lastClickAt ? new Date(l.lastClickAt).getTime() : 0
      );
      return t >= cutoff;
    });
  }, [leads]);

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm transition-colors ${
      active ? "bg-nova-soft/70 text-ink" : "text-ink-2 hover:text-ink"
    }`;

  return (
    <Shell>
      <div className="space-y-5">
        {/* Header */}
        <section className="glass p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Bellijst</h1>
              <p className="mt-1 max-w-2xl text-sm text-ink-2">
                Iedereen die je e-mail opende of doorklikte naar de Website Check —
                warm genoeg om te bellen. Log elk gesprek, dan houd ik de lijst bij.
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-nova">{counts.todo}</p>
                <p className="text-xs text-ink-3">nog bellen</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-warm">{counts.callback}</p>
                <p className="text-xs text-ink-3">terugbellen</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-good">{counts.reached}</p>
                <p className="text-xs text-ink-3">bereikt</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button className={chip(engagement === "all")} onClick={() => setEngagement("all")}>
              Alles
            </button>
            <button
              className={chip(engagement === "clicked")}
              onClick={() => setEngagement("clicked")}
            >
              Geklikt 🔥
            </button>
            <button
              className={chip(engagement === "opened")}
              onClick={() => setEngagement("opened")}
            >
              Alleen geopend
            </button>
            <span className="mx-2 h-5 w-px bg-line" aria-hidden />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CallStatus | "all")}
              className="rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-nova"
            >
              <option value="all">Alle statussen</option>
              {(Object.keys(STATUS_LABEL) as CallStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* 🔥 Nu actief — prospects reading the mail right now */}
        {hot.length > 0 && (
          <section className="hot-glow rounded-[1.1rem] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-warm">
              🔥 Nu actief — bel binnen 5 minuten
              <span className="font-normal text-ink-3">
                (contact binnen 5 min ≈ 21× meer kwalificaties)
              </span>
            </h2>
            <ul className="space-y-2">
              {hot.map((l) => (
                <li
                  key={l.leadId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-panel-2/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {l.company}
                      <span className="ml-2 text-xs font-normal text-warm">
                        {l.lastClickAt &&
                        new Date(l.lastClickAt).getTime() >= Date.now() - 30 * 60 * 1000
                          ? `klikte ${relative(l.lastClickAt)}`
                          : `opende ${relative(l.lastOpenAt)}`}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      <a
                        href={l.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-nova hover:underline"
                      >
                        {l.domain}
                      </a>{" "}
                      — zoek het nummer op en bel nu
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setOpen(l.leadId);
                      setNote("");
                    }}
                    className="shrink-0 rounded-lg bg-warm px-4 py-2 text-xs font-semibold text-void transition-opacity hover:opacity-90"
                  >
                    📞 Log gesprek
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The list */}
        {!filtered ? (
          <div className="glass flex h-40 items-center justify-center text-ink-3">
            <span className="dots text-lg">
              <span>●</span> <span>●</span> <span>●</span>
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-10 text-center text-sm text-ink-3">
            {leads && leads.length > 0
              ? "Geen leads binnen dit filter."
              : "Nog niemand heeft geopend of geklikt — zodra dat gebeurt verschijnen ze hier vanzelf."}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((l) => {
              const isOpen = open === l.leadId;
              return (
                <li key={l.leadId} className="glass overflow-hidden">
                  {/* Row */}
                  <div
                    className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-panel-2/40 sm:flex-nowrap"
                    onClick={() => {
                      setOpen(isOpen ? null : l.leadId);
                      setNote("");
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-ink">{l.company}</p>
                        {l.clickCount > 0 && (
                          <span className="shrink-0 rounded-full bg-good/15 px-2 py-0.5 text-[11px] text-good">
                            🔥 klikte op de check
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
                        <a
                          href={l.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-nova hover:underline"
                        >
                          {l.domain}
                        </a>
                        <a
                          href={`mailto:${l.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-ink"
                        >
                          {l.email}
                        </a>
                        {l.campaign && <span>· {l.campaign}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 text-right text-xs text-ink-2">
                      <p>
                        👁 {l.openCount}× geopend
                        {l.clickCount > 0 && <span className="text-good"> · {l.clickCount}× geklikt</span>}
                      </p>
                      <p className="text-ink-3">
                        laatst {relative(l.lastClickAt ?? l.lastOpenAt)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right text-xs">
                      {l.callCount > 0 ? (
                        <>
                          <p className="text-ink-2">📞 {l.callCount}× gebeld</p>
                          <p className="text-ink-3">
                            {l.lastOutcome ? OUTCOME_LABEL[l.lastOutcome] : ""} ·{" "}
                            {relative(l.lastCallAt)}
                          </p>
                        </>
                      ) : (
                        <p className="text-ink-3">nog niet gebeld</p>
                      )}
                    </div>

                    <select
                      value={l.callStatus}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setStatus(l.leadId, e.target.value as CallStatus)}
                      className={`shrink-0 rounded-full border-0 px-3 py-1.5 text-xs outline-none ${STATUS_PILL[l.callStatus]}`}
                    >
                      {(Object.keys(STATUS_LABEL) as CallStatus[]).map((s) => (
                        <option key={s} value={s} className="bg-panel-2 text-ink">
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Expanded: log a call + history */}
                  {isOpen && (
                    <div className="border-t border-line bg-panel-2/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-wider text-ink-3">
                        Gesprek loggen
                      </p>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Notitie (optioneel) — bv. 'eigenaar op vakantie, volgende week terugbellen'"
                        className="h-16 w-full resize-none rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm outline-none transition-colors focus:border-nova"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {OUTCOME_BUTTONS.map(({ outcome, accent }) => (
                          <button
                            key={outcome}
                            disabled={busy}
                            onClick={() => log(l.leadId, outcome)}
                            className={`rounded-lg border border-line px-3 py-1.5 text-xs transition-colors hover:border-nova hover:text-ink disabled:opacity-40 ${
                              accent ?? "text-ink-2"
                            }`}
                          >
                            {OUTCOME_LABEL[outcome]}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center gap-4 text-xs">
                        <Link href={`/leads/${l.leadId}`} className="text-nova hover:underline">
                          Volledige tijdlijn →
                        </Link>
                      </div>

                      {l.logs.length > 0 && (
                        <div className="mt-4 border-t border-line pt-3">
                          <p className="mb-2 text-xs uppercase tracking-wider text-ink-3">
                            Belgeschiedenis
                          </p>
                          <ul className="space-y-1.5">
                            {l.logs.map((entry) => (
                              <li key={entry.id} className="flex items-baseline gap-3 text-sm">
                                <span className="shrink-0 tabular-nums text-xs text-ink-3">
                                  {stamp(entry.called_at)}
                                </span>
                                <span className="shrink-0 text-ink-2">
                                  {OUTCOME_LABEL[entry.outcome]}
                                </span>
                                {entry.note && (
                                  <span className="min-w-0 flex-1 truncate text-ink-3">
                                    {entry.note}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Shell>
  );
}
