import { resolveMx } from "node:dns/promises";

const mxCache = new Map<string, boolean>();

/**
 * Checks whether the email's domain publishes MX records. Deterministic
 * network check, cached per domain for the lifetime of the process. Fails
 * open on transient DNS errors (we'd rather send to a briefly-unresolvable
 * domain than silently drop a lead; hard bounces are handled downstream).
 */
export async function domainHasMx(email: string): Promise<boolean> {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  const cached = mxCache.get(domain);
  if (cached !== undefined) return cached;
  try {
    const records = await resolveMx(domain);
    const ok = records.length > 0;
    mxCache.set(domain, ok);
    return ok;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      mxCache.set(domain, false);
      return false;
    }
    return true; // transient failure — fail open, don't cache
  }
}
