import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CALL_OUTCOMES,
  CALL_STATUSES,
  listCallLeads,
  logCall,
  setCallStatus,
} from "@/lib/calls";

/** The Bellijst: everyone who opened or clicked, with call history. */
export async function GET() {
  const leads = await listCallLeads();
  return NextResponse.json({ leads });
}

const logSchema = z.object({
  leadId: z.string().uuid(),
  outcome: z.enum(CALL_OUTCOMES as [string, ...string[]]),
  note: z.string().max(2000).optional(),
});

/** Log one phone attempt. */
export async function POST(request: NextRequest) {
  const parsed = logSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid call log" }, { status: 400 });
  }
  const result = await logCall(
    parsed.data.leadId,
    parsed.data.outcome as (typeof CALL_OUTCOMES)[number],
    parsed.data.note ?? ""
  );
  if (!result.ok) return NextResponse.json({ error: "insert failed" }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}

const statusSchema = z.object({
  leadId: z.string().uuid(),
  callStatus: z.enum(CALL_STATUSES as [string, ...string[]]),
});

/** Manual working-status override. */
export async function PATCH(request: NextRequest) {
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const ok = await setCallStatus(
    parsed.data.leadId,
    parsed.data.callStatus as (typeof CALL_STATUSES)[number]
  );
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
