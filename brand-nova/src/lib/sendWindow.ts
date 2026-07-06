import type { Settings } from "./types";

interface LocalTime {
  minutesSinceMidnight: number;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  dateKey: string; // YYYY-MM-DD in the configured timezone
}

/** Current wall-clock time in the settings' timezone, without libraries. */
export function localTime(tz: string, now = new Date()): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hour = parseInt(get("hour"), 10) % 24; // "24" at midnight in some ICU versions
  return {
    minutesSinceMidnight: hour * 60 + parseInt(get("minute"), 10),
    dayOfWeek: days.indexOf(get("weekday")),
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

/** Whether we are inside the configured sending window right now. */
export function isWithinSendingWindow(
  settings: Settings,
  now = new Date()
): boolean {
  const { start, end, tz, days } = settings.sending_hours;
  const local = localTime(tz, now);
  if (!days.includes(local.dayOfWeek)) return false;
  return (
    local.minutesSinceMidnight >= parseHHMM(start) &&
    local.minutesSinceMidnight < parseHHMM(end)
  );
}

/** Minutes remaining in today's sending window (0 if outside it). */
export function minutesLeftInWindow(settings: Settings, now = new Date()): number {
  if (!isWithinSendingWindow(settings, now)) return 0;
  const local = localTime(settings.sending_hours.tz, now);
  return parseHHMM(settings.sending_hours.end) - local.minutesSinceMidnight;
}

/**
 * How many emails this tick may send, so the daily cap is spread across the
 * whole window instead of firing as one burst at opening time. `sentToday`
 * is the authoritative count from the database.
 */
export function sendBudgetForTick(
  settings: Settings,
  sentToday: number,
  tickMinutes: number,
  now = new Date()
): number {
  const capLeft = settings.daily_send_cap - sentToday;
  if (capLeft <= 0) return 0;
  const minutesLeft = minutesLeftInWindow(settings, now);
  if (minutesLeft <= 0) return 0;
  const ticksLeft = Math.max(1, Math.ceil(minutesLeft / tickMinutes));
  return Math.max(1, Math.min(capLeft, Math.ceil(capLeft / ticksLeft)));
}

/** Start of the current local day, as a UTC ISO string, for "sent today" queries. */
export function startOfLocalDayUtc(tz: string, now = new Date()): string {
  const local = localTime(tz, now);
  // Walk back from `now` by the minutes elapsed in the local day.
  const startMs = now.getTime() - local.minutesSinceMidnight * 60_000;
  const start = new Date(startMs);
  start.setUTCSeconds(0, 0);
  return start.toISOString();
}
