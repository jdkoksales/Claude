-- Cached morning briefings. Regenerated at most once per TTL so the dashboard
-- poll doesn't re-hit the model on every refresh and the wording stays stable
-- for a while. facts is the structured snapshot the text was written from.
create table if not exists bn_briefings (
  id bigint generated always as identity primary key,
  text text not null,
  facts jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists bn_briefings_time_idx on bn_briefings (created_at desc);
alter table bn_briefings enable row level security;
