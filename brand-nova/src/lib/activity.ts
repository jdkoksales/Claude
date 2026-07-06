import { db } from "./supabase";
import type { ActivityType } from "./types";

/**
 * Writes one line to the live activity feed. Every message here corresponds
 * to something that actually happened in the pipeline — the feed is a view on
 * real database events, never invented status.
 */
export async function logActivity(
  type: ActivityType,
  message: string,
  options: { companyId?: string; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  const { error } = await db().from("bn_activity_log").insert({
    type,
    message,
    company_id: options.companyId ?? null,
    metadata: options.metadata ?? {},
  });
  if (error) {
    // The feed is observability, not business logic — never fail the
    // pipeline over it.
    console.error("activity log insert failed:", error.message);
  }
}
