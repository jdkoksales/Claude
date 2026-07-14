-- Brand Nova — campaigns, lead pool, and full email analytics.
-- Additive only: existing tables/columns are untouched, so current sending,
-- bounce handling and the control room keep working exactly as before.
-- Same convention as the rest of the schema: bn_ prefix, RLS on with no
-- policies (server talks to the DB with the service-role key only).

-- ---------------------------------------------------------------------------
-- Campaigns. A lead with campaign_id = NULL sits in the shared Lead Pool;
-- assigning it to a campaign just sets this foreign key. tracking_enabled
-- decides whether that campaign's emails carry an open pixel + click redirect.
-- ---------------------------------------------------------------------------
create table if not exists bn_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status text not null default 'active'
    check (status in ('draft','active','paused','completed')),
  tracking_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Lead pool link. NULL = available in the pool. on delete set null so deleting
-- a campaign never deletes its leads — they simply return to the pool.
alter table bn_leads
  add column if not exists campaign_id uuid references bn_campaigns(id) on delete set null;
create index if not exists bn_leads_campaign_idx on bn_leads (campaign_id);

-- ---------------------------------------------------------------------------
-- Per-send tracking + denormalized analytics counters on the email row.
-- The events table below is the source of truth; these cached columns make
-- the dashboard and per-campaign aggregates cheap to read.
-- ---------------------------------------------------------------------------
alter table bn_email_sequences
  add column if not exists track_token uuid not null default gen_random_uuid(),
  add column if not exists campaign_id uuid references bn_campaigns(id) on delete set null,
  add column if not exists tracked boolean not null default false,
  add column if not exists delivered_at timestamptz,
  add column if not exists first_open_at timestamptz,
  add column if not exists last_open_at timestamptz,
  add column if not exists open_count int not null default 0,
  add column if not exists first_click_at timestamptz,
  add column if not exists last_click_at timestamptz,
  add column if not exists click_count int not null default 0,
  add column if not exists clicked_url text,
  add column if not exists complained_at timestamptz;

create unique index if not exists bn_email_sequences_token_idx
  on bn_email_sequences (track_token);
create index if not exists bn_email_sequences_campaign_idx
  on bn_email_sequences (campaign_id) where campaign_id is not null;

-- ---------------------------------------------------------------------------
-- The analytics event store: one row per tracked event, in chronological
-- order. Powers lead timelines, the live feed and every KPI. campaign_id is
-- denormalized for fast per-campaign rollups.
--
-- Dedup / retry-safety: provider events (delivered/bounced/complained) carry
-- the webhook's stable svix-id in provider_event_id with a UNIQUE index, so a
-- redelivered webhook is a no-op (ON CONFLICT DO NOTHING). Self-hosted
-- open/click hits have provider_event_id = NULL and are recorded as they come.
-- ---------------------------------------------------------------------------
create table if not exists bn_email_events (
  id bigint generated always as identity primary key,
  email_sequence_id uuid references bn_email_sequences(id) on delete cascade,
  lead_id uuid references bn_leads(id) on delete cascade,
  campaign_id uuid references bn_campaigns(id) on delete set null,
  type text not null check (type in (
    'sent','delivered','opened','clicked','bounced','complained',
    'unsubscribed','failed'
  )),
  url text,
  user_agent text,
  provider_event_id text,
  occurred_at timestamptz not null default now()
);

create unique index if not exists bn_email_events_provider_idx
  on bn_email_events (provider_event_id) where provider_event_id is not null;
create index if not exists bn_email_events_lead_time_idx
  on bn_email_events (lead_id, occurred_at);
create index if not exists bn_email_events_campaign_type_idx
  on bn_email_events (campaign_id, type);
create index if not exists bn_email_events_seq_idx
  on bn_email_events (email_sequence_id);
create index if not exists bn_email_events_type_time_idx
  on bn_email_events (type, occurred_at desc);

alter table bn_campaigns enable row level security;
alter table bn_email_events enable row level security;
