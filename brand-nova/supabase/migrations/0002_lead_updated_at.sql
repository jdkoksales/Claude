-- Tracks when a lead row last changed, so a crashed serverless invocation
-- that left a lead in 'sending' can be detected and recovered safely.

alter table bn_leads add column if not exists updated_at timestamptz not null default now();

create or replace function bn_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bn_leads_touch on bn_leads;
create trigger bn_leads_touch
  before update on bn_leads
  for each row execute function bn_touch_updated_at();
