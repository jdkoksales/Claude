import { db } from "./supabase";
import type { Settings } from "./types";

/**
 * Loads the single settings row. Every tunable (send cap, hours, goal,
 * follow-up timing) lives here — nothing volume-related is hardcoded.
 */
export async function getSettings(): Promise<Settings> {
  const { data, error } = await db()
    .from("bn_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) {
    throw new Error(`Failed to load settings: ${error?.message ?? "no row"}`);
  }
  return data as Settings;
}

export async function updateSettings(
  patch: Partial<Omit<Settings, "id">>
): Promise<Settings> {
  const { data, error } = await db()
    .from("bn_settings")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to update settings: ${error?.message ?? "no row"}`);
  }
  return data as Settings;
}
