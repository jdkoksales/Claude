import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 12_000;

export interface HomepageResult {
  ok: boolean;
  text: string;
  title: string;
  finalUrl: string;
  error?: string;
}

// Present as a real, current Chrome on Windows. Many sites (and the WAFs in
// front of them) reject anything that looks like a bot with a 403, so an
// honest "BrandNovaBot" UA gets blocked far more than a normal browser one.
const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "nl-NL,nl;q=0.9,en;q=0.8",
  "sec-ch-ua": '"Chromium";v="126", "Not.A/Brand";v="24", "Google Chrome";v="126"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

/**
 * Fetches a company homepage and extracts readable text, deterministically.
 * Bounded in time and size so a slow or hostile site can never stall the
 * pipeline. Falls back from https to http-style redirects automatically via
 * fetch's redirect following.
 */
export async function fetchHomepage(url: string): Promise<HomepageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) {
      return { ok: false, text: "", title: "", finalUrl: res.url, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { ok: false, text: "", title: "", finalUrl: res.url, error: `not HTML (${contentType})` };
    }

    // Read at most MAX_BYTES.
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let received = 0;
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const $ = cheerio.load(html);
    // Pull metadata BEFORE stripping tags — og:/meta tags carry a usable
    // summary even when a site renders its body with JavaScript.
    const title = $("title").first().text().trim();
    const metaBits = [
      $('meta[name="description"]').attr("content"),
      $('meta[property="og:title"]').attr("content"),
      $('meta[property="og:description"]').attr("content"),
      $('meta[property="og:site_name"]').attr("content"),
      $('meta[name="keywords"]').attr("content"),
    ]
      .map((v) => v?.trim())
      .filter((v): v is string => !!v);

    $("script, style, noscript, svg, iframe, template").remove();

    // Prefer main content containers; fall back to body.
    const root = $("main").length ? $("main") : $("body");
    const bodyText = root.text().replace(/\s+/g, " ").trim();

    const combined = [title, ...metaBits, bodyText]
      .filter(Boolean)
      .join("\n")
      .replace(/[ \t]+/g, " ")
      .slice(0, MAX_TEXT_CHARS);

    // Only give up when there is genuinely almost nothing to work with —
    // title + meta + body together. A site that renders its body via JS but
    // still ships a decent <title>/description is worth analyzing.
    if (combined.replace(/\s/g, "").length < 60) {
      return {
        ok: false,
        text: "",
        title,
        finalUrl: res.url,
        error: "page has too little readable text (likely JS-only rendering)",
      };
    }

    return { ok: true, text: combined, title, finalUrl: res.url };
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : err instanceof Error
          ? err.message
          : String(err);
    return { ok: false, text: "", title: "", finalUrl: url, error: message };
  } finally {
    clearTimeout(timer);
  }
}
