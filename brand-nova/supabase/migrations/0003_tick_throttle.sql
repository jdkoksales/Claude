-- The 5-minute heartbeat is driven by GitHub Actions (Vercel Hobby only
-- allows daily crons), so /api/cron/tick is publicly reachable. This column
-- backs an atomic claim that throttles ticks to once per ~4 minutes, making
-- unauthenticated calls harmless: they can never make the employee do more
-- than its normal cadence.
alter table bn_settings add column if not exists last_tick_at timestamptz not null default 'epoch';

-- Atomic tick claim: returns true for exactly one caller per throttle window.
create or replace function bn_claim_tick(min_interval_seconds int default 240)
returns boolean language sql volatile as $$
  update bn_settings
     set last_tick_at = now()
   where id = 1
     and last_tick_at < now() - make_interval(secs => min_interval_seconds)
  returning true;
$$;
