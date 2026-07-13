import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@/lib/settings";

const patchSchema = z
  .object({
    user_name: z.string().min(1).max(60),
    from_name: z.string().min(1).max(80),
    from_email: z.string().email().or(z.literal("")),
    website_check_url: z.string().url().or(z.literal("")),
    daily_send_cap: z.number().int().min(1).max(5000),
    sending_hours: z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      tz: z.string().min(1),
      days: z.array(z.number().int().min(0).max(6)).min(1),
    }),
    daily_warm_lead_goal: z.number().int().min(1).max(500),
    max_followups: z.number().int().min(0).max(3),
    followup_delay_days: z.array(z.number().int().min(1).max(60)).max(3),
    auto_reply_confidence_threshold: z.number().min(0).max(1),
    auto_reply_enabled: z.boolean(),
    paused: z.boolean(),
  })
  .partial();

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid settings", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const updated = await updateSettings(parsed.data);
  return NextResponse.json(updated);
}
