-- One atomic, retry-safe entry point for recording an email event.
-- Inserts into bn_email_events (deduplicating provider webhook retries on
-- provider_event_id via the partial unique index) and, only when a NEW row was
-- actually inserted, updates the denormalized counters on bn_email_sequences.
-- Returns true when a new event was recorded, false when it was a duplicate.
create or replace function bn_record_email_event(
  p_seq uuid,
  p_lead uuid,
  p_campaign uuid,
  p_type text,
  p_url text,
  p_ua text,
  p_provider_event_id text,
  p_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
  v_at timestamptz := coalesce(p_at, now());
begin
  insert into bn_email_events(
    email_sequence_id, lead_id, campaign_id, type, url, user_agent,
    provider_event_id, occurred_at
  )
  values (p_seq, p_lead, p_campaign, p_type, p_url, p_ua, p_provider_event_id, v_at)
  on conflict (provider_event_id) where provider_event_id is not null do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  if p_seq is not null then
    if p_type = 'delivered' then
      update bn_email_sequences
        set delivered_at = coalesce(delivered_at, v_at)
        where id = p_seq;
    elsif p_type = 'opened' then
      update bn_email_sequences
        set open_count = open_count + 1,
            first_open_at = coalesce(first_open_at, v_at),
            last_open_at = v_at
        where id = p_seq;
    elsif p_type = 'clicked' then
      update bn_email_sequences
        set click_count = click_count + 1,
            first_click_at = coalesce(first_click_at, v_at),
            last_click_at = v_at,
            clicked_url = coalesce(p_url, clicked_url)
        where id = p_seq;
    elsif p_type = 'complained' then
      update bn_email_sequences
        set complained_at = coalesce(complained_at, v_at)
        where id = p_seq;
    elsif p_type = 'bounced' then
      update bn_email_sequences
        set status = 'bounced'
        where id = p_seq and status <> 'bounced';
    end if;
  end if;

  return true;
end;
$$;
