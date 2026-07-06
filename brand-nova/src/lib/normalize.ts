/**
 * Deterministic normalization used for dedupe. No AI anywhere in this file.
 */

/** Normalizes a website URL/domain to a canonical dedupe key. */
export function normalizeDomain(input: string): string | null {
  let raw = input.trim().toLowerCase();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const url = new URL(raw);
    let host = url.hostname;
    if (host.startsWith("www.")) host = host.slice(4);
    if (!host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

/** Canonical fetchable URL for a normalized domain. */
export function websiteUrlForDomain(domain: string): string {
  return `https://${domain}/`;
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** RFC-ish syntax check. MX validation happens separately (network). */
export function isValidEmailSyntax(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length <= 254 && EMAIL_RE.test(trimmed);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
