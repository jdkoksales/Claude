-- Call tracking for the Bellijst: every phone attempt is a log row; the lead
-- carries a single working status so the list can be filtered ("nog bellen",
-- "terugbellen", ...). Same conventions as the rest: bn_ prefix, RLS on with
-- no policies (service-role only).

create table if not exists bn_call_logs (
  id bigint generated always as identity primary key,
  lead_id uuid not null references bn_leads(id) on delete cascade,
  outcome text not null check (outcome in (
    'answered','no_answer','voicemail','callback',
    'interested','not_interested','converted','wrong_number'
  )),
  note text not null default '',
  called_at timestamptz not null default now()
);
create index if not exists bn_call_logs_lead_idx on bn_call_logs (lead_id, called_at desc);

alter table bn_leads add column if not exists call_status text not null default 'todo'
  check (call_status in ('todo','callback','reached','done','skip'));

alter table bn_call_logs enable row level security;
