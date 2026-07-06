"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import type { LeadStatus } from "@/lib/types";

interface LeadRow {
  id: string;
  status: LeadStatus;
  warm_since: string | null;
  followups_sent: number;
  created_at: string;
  bn_companies: {
    id: string;
    name: string;
    domain: string;
    email: string;
    industry: string | null;
  };
}

const STATUS_LABEL: Record<string, string> = {
  new: "nieuw",
  queued: "in wachtrij",
  sending: "wordt gemaild",
  emailed: "gemaild",
  followup_1: "follow-up 1",
  followup_2: "follow-up 2",
  followup_3: "follow-up 3",
  positive_reply: "🔥 positieve reactie",
  question: "🔥 vraag",
  warm_lead: "🔥 warme lead",
  meeting_request: "🔥 afspraakverzoek",
  website_check_completed: "🔥 check gedaan",
  not_interested: "geen interesse",
  spam: "spam",
  out_of_office: "afwezig",
  bounced: "gebounced",
  unsubscribed: "uitgeschreven",
  stopped: "gestopt",
  skipped: "overgeslagen",
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Alles" },
  { value: "warm_lead", label: "Warme leads" },
  { value: "meeting_request", label: "Afspraken" },
  { value: "question", label: "Vragen" },
  { value: "queued", label: "Wachtrij" },
  { value: "emailed", label: "Gemaild" },
  { value: "skipped", label: "Overgeslagen" },
];

const MANUAL_STATUSES: Array<{ value: string; label: string }> = [
  { value: "warm_lead", label: "warme lead" },
  { value: "website_check_completed", label: "check gedaan" },
  { value: "meeting_request", label: "afspraakverzoek" },
  { value: "not_interested", label: "geen interesse" },
  { value: "stopped", label: "stop outreach" },
  { value: "queued", label: "opnieuw in wachtrij" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    params.set("page", String(page));
    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 50);
    }
  }, [status, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function setLeadStatus(id: string, newStatus: string) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  }

  const pages = Math.ceil(total / pageSize);

  return (
    <Shell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(0);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                status === f.value
                  ? "bg-nova-soft/60 text-ink"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Zoek bedrijf…"
            className="ml-auto w-48 rounded-full border border-line bg-panel-2 px-4 py-1.5 text-sm outline-none transition-colors focus:border-nova"
          />
        </div>

        <section className="glass overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3 font-medium">Bedrijf</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Branche</th>
                <th className="px-4 py-3 font-medium">Follow-ups</th>
                <th className="px-4 py-3 font-medium">Actie</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-line/50 transition-colors hover:bg-panel-2/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">
                      {lead.bn_companies.name}
                    </div>
                    <div className="text-xs text-ink-3">
                      {lead.bn_companies.domain} · {lead.bn_companies.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {STATUS_LABEL[lead.status] ?? lead.status}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {lead.bn_companies.industry ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-2">
                    {lead.followups_sent}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-line bg-panel-2 px-2 py-1 text-xs text-ink-2 outline-none"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setLeadStatus(lead.id, e.target.value);
                      }}
                    >
                      <option value="">wijzig…</option>
                      {MANUAL_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-3">
                    Geen leads gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm text-ink-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="disabled:opacity-30"
            >
              ← Vorige
            </button>
            <span className="tabular-nums">
              {page + 1} / {pages}
            </span>
            <button
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
              className="disabled:opacity-30"
            >
              Volgende →
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
