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
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; BrandNovaBot/1.0; website analysis for outreach personalization)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "nl,en;q=0.8",
      },
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
    $("script, style, noscript, svg, iframe, template").remove();
    const title = $("title").first().text().trim();
    const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";

    // Prefer main content containers; fall back to body.
    const root = $("main").length ? $("main") : $("body");
    const text = root
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT_CHARS);

    if (text.length < 100) {
      return {
        ok: false,
        text: "",
        title,
        finalUrl: res.url,
        error: "page has too little readable text (likely JS-only rendering)",
      };
    }

    const combined = [title, metaDescription, text]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_TEXT_CHARS);
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
