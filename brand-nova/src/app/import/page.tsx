"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import type { ImportReport } from "@/lib/csvImport";

export default function ImportPage() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setReport(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: formData });
    setBusy(false);
    const data = await res.json();
    if (res.ok) setReport(data);
    else setError(data.error ?? "Import mislukt");
  }

  return (
    <Shell>
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="glass p-6">
          <h1 className="text-lg font-semibold">Leads importeren</h1>
          <p className="mt-1 text-sm text-ink-2">
            Upload een CSV met kolommen voor bedrijfsnaam, website en
            e-mailadres. Ik ontdubbel, valideer en ga daarna zelf aan de slag.
          </p>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) upload(file);
            }}
            className={`mt-5 flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed transition-colors ${
              dragOver ? "border-nova bg-nova-soft/30" : "border-line hover:border-ink-3"
            }`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            {busy ? (
              <span className="dots text-nova">
                <span>●</span> <span>●</span> <span>●</span>
              </span>
            ) : (
              <>
                <span className="text-sm text-ink-2">
                  Sleep je CSV hierheen of klik om te kiezen
                </span>
                <span className="mt-1 text-xs text-ink-3">
                  bedrijfsnaam · website · e-mail
                </span>
              </>
            )}
          </label>
          {error && <p className="mt-3 text-sm text-warm">{error}</p>}
        </section>

        {report && (
          <section className="glass p-6">
            <h2 className="text-sm font-medium text-good">
              Import afgerond — ik neem het vanaf hier over.
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-3">Rijen in bestand</dt>
                <dd className="text-lg font-medium tabular-nums">{report.total}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Nieuw geïmporteerd</dt>
                <dd className="text-lg font-medium tabular-nums text-good">
                  {report.imported}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Duplicaten</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {report.duplicatesInFile + report.duplicatesExisting}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Ongeldige e-mails</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {report.invalidEmail}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Ongeldige websites</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {report.invalidWebsite}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Uitgeschreven</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {report.unsubscribed}
                </dd>
              </div>
            </dl>
            {report.rejected.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-ink-3 hover:text-ink">
                  Afgekeurde rijen ({report.rejected.length})
                </summary>
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-ink-2">
                  {report.rejected.map((r) => (
                    <li key={`${r.row}-${r.company}`}>
                      Rij {r.row} — {r.company}: {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </div>
    </Shell>
  );
}
