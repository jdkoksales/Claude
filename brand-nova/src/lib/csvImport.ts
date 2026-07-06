import Papa from "papaparse";
import { db } from "./supabase";
import { logActivity } from "./activity";
import { domainHasMx } from "./emailValidation";
import {
  isValidEmailSyntax,
  normalizeDomain,
  normalizeEmail,
  websiteUrlForDomain,
} from "./normalize";

export interface ImportReport {
  importId: string;
  total: number;
  imported: number;
  duplicatesInFile: number;
  duplicatesExisting: number;
  invalidEmail: number;
  invalidWebsite: number;
  unsubscribed: number;
  rejected: Array<{ row: number; company: string; reason: string }>;
}

interface ParsedRow {
  company: string;
  website: string;
  email: string;
}

/** Header aliases so real-world CSVs import without manual mapping. */
const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  company: ["company", "company name", "bedrijf", "bedrijfsnaam", "naam", "name"],
  website: ["website", "url", "site", "domain", "domein", "website url"],
  email: ["email", "e-mail", "email address", "e-mailadres", "mail"],
};

function mapHeaders(fields: string[]): Partial<Record<keyof ParsedRow, string>> {
  const mapping: Partial<Record<keyof ParsedRow, string>> = {};
  for (const field of fields) {
    const lower = field.trim().toLowerCase();
    for (const key of Object.keys(HEADER_ALIASES) as (keyof ParsedRow)[]) {
      if (!mapping[key] && HEADER_ALIASES[key].includes(lower)) {
        mapping[key] = field;
      }
    }
  }
  return mapping;
}

/**
 * Full import pipeline: parse → map headers → normalize → dedupe (in-file and
 * against the database) → validate email syntax + MX → respect the permanent
 * unsubscribe list → insert companies + leads. Entirely deterministic; no AI.
 */
export async function importCsv(
  filename: string,
  csvText: string
): Promise<ImportReport> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const fields = parsed.meta.fields ?? [];
  const headerMap = mapHeaders(fields);
  if (!headerMap.company || !headerMap.website || !headerMap.email) {
    throw new Error(
      `CSV must contain company, website and email columns (found: ${fields.join(", ") || "none"})`
    );
  }

  const report: Omit<ImportReport, "importId"> = {
    total: parsed.data.length,
    imported: 0,
    duplicatesInFile: 0,
    duplicatesExisting: 0,
    invalidEmail: 0,
    invalidWebsite: 0,
    unsubscribed: 0,
    rejected: [],
  };

  // Normalize + in-file dedupe.
  const seenDomains = new Set<string>();
  const candidates: Array<{ row: number; name: string; domain: string; email: string }> = [];
  parsed.data.forEach((raw, i) => {
    const row = i + 2; // 1-based + header row
    const name = (raw[headerMap.company!] ?? "").trim();
    const website = (raw[headerMap.website!] ?? "").trim();
    const email = normalizeEmail(raw[headerMap.email!] ?? "");
    const domain = normalizeDomain(website);
    if (!domain) {
      report.invalidWebsite++;
      report.rejected.push({ row, company: name || website, reason: "invalid website" });
      return;
    }
    if (!isValidEmailSyntax(email)) {
      report.invalidEmail++;
      report.rejected.push({ row, company: name || domain, reason: "invalid email syntax" });
      return;
    }
    if (seenDomains.has(domain)) {
      report.duplicatesInFile++;
      return;
    }
    seenDomains.add(domain);
    candidates.push({ row, name: name || domain, domain, email });
  });

  // Dedupe against companies already in the database.
  const domains = candidates.map((c) => c.domain);
  const existing = new Set<string>();
  for (let i = 0; i < domains.length; i += 500) {
    const chunk = domains.slice(i, i + 500);
    const { data, error } = await db()
      .from("bn_companies")
      .select("domain")
      .in("domain", chunk);
    if (error) throw new Error(`dedupe query failed: ${error.message}`);
    for (const r of data ?? []) existing.add(r.domain as string);
  }

  // Respect the permanent opt-out list.
  const emails = candidates.map((c) => c.email);
  const optedOut = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    const { data, error } = await db()
      .from("bn_unsubscribes")
      .select("email")
      .in("email", chunk);
    if (error) throw new Error(`unsubscribe query failed: ${error.message}`);
    for (const r of data ?? []) optedOut.add(r.email as string);
  }

  const { data: importRow, error: importErr } = await db()
    .from("bn_csv_imports")
    .insert({ filename, row_count: report.total })
    .select("id")
    .single();
  if (importErr || !importRow) {
    throw new Error(`failed to record import: ${importErr?.message}`);
  }
  const importId = importRow.id as string;

  // MX validation + insert, in batches. MX lookups run concurrently per batch.
  for (let i = 0; i < candidates.length; i += 50) {
    const batch = candidates.filter(
      (c, idx) => idx >= i && idx < i + 50
    );
    const mxResults = await Promise.all(batch.map((c) => domainHasMx(c.email)));

    const rows: Array<Record<string, unknown>> = [];
    batch.forEach((c, j) => {
      if (existing.has(c.domain)) {
        report.duplicatesExisting++;
        return;
      }
      if (optedOut.has(c.email)) {
        report.unsubscribed++;
        report.rejected.push({ row: c.row, company: c.name, reason: "on unsubscribe list" });
        return;
      }
      if (!mxResults[j]) {
        report.invalidEmail++;
        report.rejected.push({ row: c.row, company: c.name, reason: "email domain has no MX records" });
        return;
      }
      rows.push({
        name: c.name,
        website_url: websiteUrlForDomain(c.domain),
        domain: c.domain,
        email: c.email,
        email_valid: true,
        source_csv_import_id: importId,
      });
    });

    if (rows.length > 0) {
      const { data: inserted, error } = await db()
        .from("bn_companies")
        .insert(rows)
        .select("id");
      if (error) throw new Error(`company insert failed: ${error.message}`);
      const leadRows = (inserted ?? []).map((r) => ({ company_id: r.id as string }));
      const { error: leadErr } = await db().from("bn_leads").insert(leadRows);
      if (leadErr) throw new Error(`lead insert failed: ${leadErr.message}`);
      report.imported += rows.length;
    }
  }

  await db()
    .from("bn_csv_imports")
    .update({
      duplicate_count: report.duplicatesInFile + report.duplicatesExisting,
      invalid_email_count: report.invalidEmail,
    })
    .eq("id", importId);

  await logActivity(
    "import",
    `${report.imported} nieuwe bedrijven geïmporteerd uit ${filename} ` +
      `(${report.duplicatesInFile + report.duplicatesExisting} duplicaten, ` +
      `${report.invalidEmail} ongeldige e-mailadressen overgeslagen).`,
    { metadata: { importId } }
  );

  return { importId, ...report };
}
