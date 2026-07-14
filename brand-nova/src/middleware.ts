import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge } from "@/lib/sessionEdge";

const SESSION_COOKIE = "bn_session";

/** Paths that must stay reachable without a session. */
const PUBLIC_PATHS = [
  "/login",
  "/api/login",
  "/api/unsubscribe",
  "/api/webhooks/resend",
  "/api/t", // open/click tracking pixels + redirects (public by design)
  "/api/cron/tick",
  "/api/cron/daily",
  "/api/preview", // does its own auth: session cookie or operator key
  "/api/test-send", // does its own auth: session cookie or operator key
  "/api/test-outreach", // does its own auth: session cookie or operator key
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionTokenEdge(token, process.env.APP_SECRET ?? "");
  if (valid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
