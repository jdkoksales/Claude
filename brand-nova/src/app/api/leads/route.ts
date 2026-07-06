import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

const PAGE_SIZE = 50;

/** Secondary leads listing — filterable, paginated, deliberately simple. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const q = params.get("q");
  const page = Math.max(0, Number(params.get("page") ?? 0));

  let query = db()
    .from("bn_leads")
    .select("*, bn_companies!inner(id, name, domain, email, industry)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("bn_companies.name", `%${q}%`);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ leads: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE });
}
