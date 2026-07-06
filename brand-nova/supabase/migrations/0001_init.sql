-- Brand Nova AI Employee — initial schema.
-- All tables are prefixed bn_ because this Supabase project is shared with an
-- unrelated app; the prefix keeps the two fully separated. RLS is enabled on
-- every table with NO policies: the app talks to the database exclusively via
-- the service-role key on the server, so the anon key exposes nothing.

create table if not exists bn_csv_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  row_count int not null default 0,
  duplicate_count int not null default 0,
  invalid_email_count int not null default 0,
  imported_at timestamptz not null default now()
);

create table if not exists bn_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text not null,
  domain text not null unique,
  email text not null,
  email_valid boolean,
  industry text,
  source_csv_import_id uuid references bn_csv_imports(id),
  created_at timestamptz not null default now()
);

create table if not exists bn_website_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references bn_companies(id) on delete cascade,
  raw_homepage_text text,
  fetched_at timestamptz,
  what_they_do text,
  target_audience text,
  services text[] not null default '{}',
  usp text[] not null default '{}',
  trust_signals text[] not null default '{}',
  ctas text[] not null default '{}',
  tone text,
  improvement_observation text,
  analysis_version int not null default 1,
  status text not null default 'pending'
    check (status in ('pending','done','failed','unreachable','no_observation'))
);

create table if not exists bn_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references bn_companies(id) on delete cascade,
  status text not null default 'new' check (status in (
    'new','queued','sending','emailed','followup_1','followup_2','followup_3',
    'positive_reply','question','warm_lead','meeting_request',
    'website_check_completed','not_interested','spam','out_of_office',
    'bounced','unsubscribed','stopped','skipped'
  )),
  warm_since timestamptz,
  next_action_at timestamptz,
  followups_sent int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bn_email_sequences (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references bn_leads(id) on delete cascade,
  step int not null default 0,
  subject text not null,
  body text not null,
  observation_used text,
  strategy_tags jsonb not null default '{}',
  sent_at timestamptz,
  provider_message_id text,
  status text not null default 'draft'
    check (status in ('draft','sent','bounced','failed'))
);

create table if not exists bn_replies (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references bn_leads(id) on delete cascade,
  email_sequence_id uuid references bn_email_sequences(id),
  from_email text,
  subject text,
  raw_body text not null,
  received_at timestamptz not null default now(),
  classification text check (classification in (
    'interested','question','warm_lead','meeting_request',
    'website_check_completed','not_interested','spam','out_of_office'
  )),
  classification_confidence numeric,
  auto_replied boolean not null default false,
  auto_reply_body text,
  needs_human boolean not null default false
);

create table if not exists bn_insights (
  id uuid primary key default gen_random_uuid(),
  dimension text not null,
  key text not null,
  warm_lead_rate numeric not null default 0,
  sample_size int not null default 0,
  updated_at timestamptz not null default now(),
  unique (dimension, key)
);

create table if not exists bn_activity_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  type text not null check (type in (
    'analyzing','writing','sending','reading','learning',
    'followup','warm_lead','import','system','waiting'
  )),
  company_id uuid references bn_companies(id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'
);

create table if not exists bn_settings (
  id int primary key default 1 check (id = 1),
  user_name text not null default 'Julian',
  from_name text not null default 'Brand Nova',
  from_email text not null default '',
  website_check_url text not null default '',
  daily_send_cap int not null default 200,
  sending_hours jsonb not null default '{"start":"09:00","end":"17:00","tz":"Europe/Amsterdam","days":[1,2,3,4,5]}',
  daily_warm_lead_goal int not null default 10,
  max_followups int not null default 3,
  followup_delay_days int[] not null default '{3,5,7}',
  auto_reply_confidence_threshold numeric not null default 0.7,
  paused boolean not null default false
);

insert into bn_settings (id) values (1) on conflict (id) do nothing;

-- Facts the auto-reply AI is allowed to use. Managed by the user; the model
-- must never answer from anything outside this table.
create table if not exists bn_faq_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

-- Permanent opt-out list, keyed by email so it survives lead deletion and
-- CSV re-imports.
create table if not exists bn_unsubscribes (
  email text primary key,
  unsubscribed_at timestamptz not null default now()
);

create index if not exists bn_leads_status_idx on bn_leads (status);
create index if not exists bn_leads_next_action_idx on bn_leads (next_action_at)
  where next_action_at is not null;
create index if not exists bn_email_sequences_lead_idx on bn_email_sequences (lead_id);
create index if not exists bn_email_sequences_provider_idx
  on bn_email_sequences (provider_message_id) where provider_message_id is not null;
create index if not exists bn_replies_lead_idx on bn_replies (lead_id);
create index if not exists bn_replies_needs_human_idx on bn_replies (needs_human)
  where needs_human = true;
create index if not exists bn_activity_log_time_idx on bn_activity_log (occurred_at desc);
create index if not exists bn_analyses_status_idx on bn_website_analyses (status);

alter table bn_csv_imports enable row level security;
alter table bn_companies enable row level security;
alter table bn_website_analyses enable row level security;
alter table bn_leads enable row level security;
alter table bn_email_sequences enable row level security;
alter table bn_replies enable row level security;
alter table bn_insights enable row level security;
alter table bn_activity_log enable row level security;
alter table bn_settings enable row level security;
alter table bn_faq_entries enable row level security;
alter table bn_unsubscribes enable row level security;
