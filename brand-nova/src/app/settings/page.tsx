"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import type { Settings } from "@/lib/types";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

const DAY_LABELS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [faq, setFaq] = useState<FaqEntry[]>([]);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");

  const load = useCallback(async () => {
    const [settingsRes, faqRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/faq"),
    ]);
    if (settingsRes.ok) setSettings(await settingsRes.json());
    if (faqRes.ok) setFaq((await faqRes.json()).entries ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!settings) return;
    const { id: _id, ...patch } = settings;
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function addFaq() {
    if (newQ.length < 3 || newA.length < 3) return;
    await fetch("/api/faq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: newQ, answer: newA }),
    });
    setNewQ("");
    setNewA("");
    load();
  }

  async function removeFaq(id: string) {
    await fetch(`/api/faq?id=${id}`, { method: "DELETE" });
    load();
  }

  if (!settings) {
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

  const field =
    "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm outline-none transition-colors focus:border-nova";
  const label = "mb-1 block text-xs uppercase tracking-wider text-ink-3";

  return (
    <Shell>
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="glass space-y-4 p-6">
          <h1 className="text-lg font-semibold">Instellingen</h1>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Jouw naam (begroeting)</label>
              <input
                className={field}
                value={settings.user_name}
                onChange={(e) =>
                  setSettings({ ...settings, user_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className={label}>Afzendernaam</label>
              <input
                className={field}
                value={settings.from_name}
                onChange={(e) =>
                  setSettings({ ...settings, from_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className={label}>Afzend-e-mailadres (Resend-domein)</label>
              <input
                className={field}
                value={settings.from_email}
                placeholder="julian@outreach.brandnova.nl"
                onChange={(e) =>
                  setSettings({ ...settings, from_email: e.target.value })
                }
              />
            </div>
            <div>
              <label className={label}>Website Check URL</label>
              <input
                className={field}
                value={settings.website_check_url}
                placeholder="https://brandnova.nl/website-check"
                onChange={(e) =>
                  setSettings({ ...settings, website_check_url: e.target.value })
                }
              />
            </div>
            <div>
              <label className={label}>Max e-mails per dag</label>
              <input
                type="number"
                min={1}
                max={5000}
                className={field}
                value={settings.daily_send_cap}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    daily_send_cap: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div>
              <label className={label}>Verzendtempo</label>
              <select
                className={field}
                value={settings.send_interval_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    send_interval_minutes: Number(e.target.value),
                  })
                }
              >
                <option value={0}>Automatisch (verspreid over de dag)</option>
                <option value={1}>Elke minuut 1 mail (snel/test)</option>
                <option value={2}>Elke 2 minuten 1 mail</option>
                <option value={3}>Elke 3 minuten 1 mail</option>
                <option value={5}>Elke 5 minuten 1 mail</option>
                <option value={10}>Elke 10 minuten 1 mail</option>
                <option value={15}>Elke 15 minuten 1 mail</option>
                <option value={20}>Elke 20 minuten 1 mail</option>
                <option value={30}>Elke 30 minuten 1 mail</option>
                <option value={60}>Elk uur 1 mail</option>
              </select>
            </div>
            <div>
              <label className={label}>Doel: warme leads per dag</label>
              <input
                type="number"
                min={1}
                max={500}
                className={field}
                value={settings.daily_warm_lead_goal}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    daily_warm_lead_goal: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div>
              <label className={label}>Verzendvenster (start – eind)</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  className={field}
                  value={settings.sending_hours.start}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sending_hours: {
                        ...settings.sending_hours,
                        start: e.target.value,
                      },
                    })
                  }
                />
                <input
                  type="time"
                  className={field}
                  value={settings.sending_hours.end}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sending_hours: {
                        ...settings.sending_hours,
                        end: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className={label}>Verzenddagen</label>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((day, i) => {
                  const active = settings.sending_hours.days.includes(i);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const days = active
                          ? settings.sending_hours.days.filter((d) => d !== i)
                          : [...settings.sending_hours.days, i].sort();
                        if (days.length === 0) return;
                        setSettings({
                          ...settings,
                          sending_hours: { ...settings.sending_hours, days },
                        });
                      }}
                      className={`h-9 w-9 rounded-lg text-xs transition-colors ${
                        active
                          ? "bg-nova-soft/70 text-ink"
                          : "border border-line text-ink-3 hover:text-ink"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={label}>Max follow-ups (0–3)</label>
              <input
                type="number"
                min={0}
                max={3}
                className={field}
                value={settings.max_followups}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_followups: Math.min(3, Math.max(0, Number(e.target.value))),
                  })
                }
              />
            </div>
            <div>
              <label className={label}>Follow-up na (dagen, per stap)</label>
              <input
                className={field}
                value={settings.followup_delay_days.join(", ")}
                onChange={(e) => {
                  const days = e.target.value
                    .split(",")
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 60)
                    .slice(0, 3);
                  setSettings({ ...settings, followup_delay_days: days });
                }}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-panel-2/50 p-3">
            <input
              type="checkbox"
              checked={settings.auto_reply_enabled}
              onChange={(e) =>
                setSettings({ ...settings, auto_reply_enabled: e.target.checked })
              }
              className="h-4 w-4 accent-[#7c8cff]"
            />
            <span className="text-sm">
              <span className="font-medium text-ink">
                Automatisch simpele vragen beantwoorden
              </span>
              <span className="block text-xs text-ink-3">
                Uit = de AI classificeert reacties alleen; jij beantwoordt alles
                zelf vanuit je eigen inbox.
              </span>
            </span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              className="rounded-lg bg-nova px-5 py-2 text-sm font-medium text-void transition-opacity hover:opacity-90"
            >
              Opslaan
            </button>
            {saved && <span className="text-sm text-good">Opgeslagen.</span>}
          </div>
        </section>

        <section className="glass space-y-4 p-6">
          <div>
            <h2 className="text-base font-semibold">Kennisbank voor auto-antwoorden</h2>
            <p className="mt-1 text-sm text-ink-2">
              Ik beantwoord vragen van prospects uitsluitend met deze feiten.
              Staat het antwoord er niet in, dan leg ik de vraag aan jou voor.
            </p>
          </div>
          <ul className="space-y-2">
            {faq.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-line bg-panel-2/60 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{entry.question}</p>
                    <p className="mt-1 text-ink-2">{entry.answer}</p>
                  </div>
                  <button
                    onClick={() => removeFaq(entry.id)}
                    className="shrink-0 text-xs text-ink-3 hover:text-warm"
                  >
                    Verwijder
                  </button>
                </div>
              </li>
            ))}
            {faq.length === 0 && (
              <li className="py-4 text-center text-sm text-ink-3">
                Nog geen feiten — vragen worden voorlopig altijd aan jou voorgelegd.
              </li>
            )}
          </ul>
          <div className="space-y-2 border-t border-line pt-4">
            <input
              className={field}
              placeholder="Vraag (bv. Wat kost de Website Check?)"
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
            />
            <textarea
              className={`${field} h-20 resize-none`}
              placeholder="Antwoord (bv. De Website Check is volledig gratis.)"
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
            />
            <button
              onClick={addFaq}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 transition-colors hover:border-nova hover:text-ink"
            >
              Toevoegen
            </button>
          </div>
        </section>
      </div>
    </Shell>
  );
}
