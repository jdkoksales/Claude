"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";

interface EventRow {
  type: string;
  url: string | null;
  occurred_at: string;
}
interface EmailRow {
  step: number;
  subject: string;
  body: string;
  sent_at: string | null;
  status: string;
  open_count: number;
  click_count: number;
}
interface ReplyRow {
  from_email: string | null;
  subject: string | null;
  raw_body: string;
  received_at: string;
  classification: string | null;
}
interface LeadDetail {
  lead: {
    id: string;
    status: string;
    company: { name: string; email: string; domain: string; website_url: string; industry: string | null } | null;
    campaign: { id: string; name: string } | null;
  };
  emails: EmailRow[];
  replies: ReplyRow[];
  events: EventRow[];
}

const EVENT_META: Record<string, { label: string; dot: string }> = {
  sent: { label: "E-mail verstuurd", dot: "bg-nova" },
  delivered: { label: "Afgeleverd", dot: "bg-nova/70" },
  opened: { label: "E-mail geopend", dot: "bg-[#c08bff]" },
  clicked: { label: "Doorgeklikt naar Website Check", dot: "bg-good" },
  bounced: { label: "Gebounced", dot: "bg-warm" },
  complained: { label: "Als spam gemarkeerd", dot: "bg-warm" },
  unsubscribed: { label: "Uitgeschreven", dot: "bg-ink-3" },
};

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TimelineItem =
  | { kind: "event"; at: string; type: string }
  | { kind: "reply"; at: string; reply: ReplyRow };

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LeadDetail | null>(null);
  const [openMail, setOpenMail] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [id]);

  if (!data) {
    return (
      <Shell>
        <div className="flex h-64 items-center justify-center text-ink-3">
          <span className="dots text-lg">
            <span>●</span> <span>●</span> <span>●</span>
          </span>
        </div>
      </Shell>
    );
  }

  const company = data.lead.company;
  const timeline: TimelineItem[] = [
    ...data.events.map((e) => ({ kind: "event" as const, at: e.occurred_at, type: e.type })),
    ...data.replies.map((r) => ({ kind: "reply" as const, at: r.received_at, reply: r })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const lastActivity = timeline.length ? timeline[timeline.length - 1].at : null;

  return (
    <Shell>
      <div className="space-y-5">
        <Link href="/leads" className="text-xs text-ink-3 hover:text-ink">
          ← Alle leads
        </Link>

        {/* Header */}
        <section className="glass p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{company?.name ?? "Onbekend bedrijf"}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                {company?.email && <span>{company.email}</span>}
                {company?.website_url && (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-nova hover:underline"
                  >
                    {company.domain}
                  </a>
                )}
                {company?.industry && <span className="text-ink-3">· {company.industry}</span>}
              </div>
            </div>
            <div className="text-right text-xs text-ink-3">
              <p>
                Status:{" "}
                <span className="text-ink-2">{data.lead.status.replace(/_/g, " ")}</span>
              </p>
              {data.lead.campaign && (
                <p className="mt-1">
                  Campagne:{" "}
                  <Link
                    href={`/campaigns/${data.lead.campaign.id}`}
                    className="text-nova hover:underline"
                  >
                    {data.lead.campaign.name}
                  </Link>
                </p>
              )}
              {lastActivity && <p className="mt-1">Laatste activiteit: {stamp(lastActivity)}</p>}
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-5">
          {/* Timeline */}
          <section className="glass p-6 lg:col-span-3">
            <h2 className="mb-4 text-sm font-medium text-ink-2">Tijdlijn</h2>
            {timeline.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-3">Nog geen activiteit.</p>
            ) : (
              <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
                {timeline.map((item, i) => (
                  <li key={i} className="relative">
                    {item.kind === "event" ? (
                      <>
                        <span
                          className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ${
                            EVENT_META[item.type]?.dot ?? "bg-ink-3"
                          }`}
                        />
                        <p className="text-sm text-ink">
                          {EVENT_META[item.type]?.label ?? item.type}
                        </p>
                        <p className="text-xs tabular-nums text-ink-3">{stamp(item.at)}</p>
                      </>
                    ) : (
                      <>
                        <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-warm" />
                        <p className="text-sm text-ink">
                          Antwoord ontvangen
                          {item.reply.classification && (
                            <span className="ml-2 text-xs text-warm">
                              {item.reply.classification.replace(/_/g, " ")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs tabular-nums text-ink-3">{stamp(item.at)}</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-panel-2/60 p-3 text-xs text-ink-2">
                          {item.reply.raw_body.slice(0, 600)}
                        </p>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Sent emails */}
          <section className="glass p-6 lg:col-span-2">
            <h2 className="mb-4 text-sm font-medium text-ink-2">Verstuurde e-mails</h2>
            {data.emails.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-3">Nog niets verstuurd.</p>
            ) : (
              <ul className="space-y-2">
                {data.emails.map((m) => (
                  <li key={m.step} className="rounded-lg border border-line bg-panel-2/50">
                    <button
                      onClick={() => setOpenMail(openMail === m.step ? null : m.step)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{m.subject}</span>
                        <span className="text-xs text-ink-3">
                          {m.step === 0 ? "Eerste mail" : `Follow-up ${m.step}`}
                          {m.sent_at ? ` · ${stamp(m.sent_at)}` : " · concept"}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-3">
                        {m.open_count > 0 && <span className="text-nova">{m.open_count}× open</span>}
                        {m.click_count > 0 && (
                          <span className="ml-2 text-good">{m.click_count}× klik</span>
                        )}
                      </span>
                    </button>
                    {openMail === m.step && (
                      <p className="whitespace-pre-wrap border-t border-line px-3 py-3 text-xs leading-relaxed text-ink-2">
                        {m.body}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
