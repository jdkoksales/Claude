"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";

interface SentEmail {
  id: string;
  step: number;
  subject: string;
  body: string;
  sent_at: string;
  bn_leads: {
    id: string;
    status: string;
    bn_companies: { name: string; domain: string; email: string };
  };
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The operator's "Sent" folder: every email the AI sent, newest first,
 * full text readable. Outgoing mail goes via Resend, so this page is the
 * only place it can be read back.
 */
export default function MailsPage() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/emails?page=${page}`);
    if (res.ok) {
      const data = await res.json();
      setEmails(data.emails ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 25);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.ceil(total / pageSize);

  return (
    <Shell>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Verstuurde mails</h1>
          <span className="text-sm tabular-nums text-ink-3">
            {total} verstuurd in totaal
          </span>
        </div>
        <p className="-mt-2 text-sm text-ink-2">
          Elke mail die ik verstuur staat hier volledig. Reacties van
          prospects komen binnen in je eigen inbox (julian@brand-nova.nl) —
          antwoorden doe je daar gewoon zelf.
        </p>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-ink-3">
            <span className="dots text-lg">
              <span>●</span> <span>●</span> <span>●</span>
            </span>
          </div>
        ) : emails.length === 0 ? (
          <section className="glass p-10 text-center text-sm text-ink-3">
            Nog geen mails verstuurd. Zodra ik begin, vind je hier elke mail
            terug.
          </section>
        ) : (
          <section className="space-y-2">
            {emails.map((email) => {
              const company = email.bn_leads?.bn_companies;
              const isOpen = open === email.id;
              return (
                <div key={email.id} className="glass overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : email.id)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-panel-2/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-medium text-ink">
                          {company?.name ?? "Onbekend"}
                        </span>
                        <span className="shrink-0 rounded-full bg-nova-soft/50 px-2 py-0.5 text-xs text-ink-2">
                          {email.step === 0 ? "eerste mail" : `follow-up ${email.step}`}
                        </span>
                      </div>
                      <div className="truncate text-sm text-ink-2">
                        {email.subject}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-ink-3">
                      {fmt(email.sent_at)}
                    </span>
                    <span className="shrink-0 text-ink-3">{isOpen ? "▴" : "▾"}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line px-4 py-4">
                      <p className="mb-3 text-xs text-ink-3">
                        Aan: {company?.email} · {company?.domain}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                        {email.body}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

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
