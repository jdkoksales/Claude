-- Aggregate analytics. Rates are computed in the app from these raw counts.
-- "opened"/"clicked" are counted as unique leads (companies), matching how the
-- product talks about them ("20 companies opened"); "sent"/"delivered"/
-- "bounced" are per-email. At ~one first-touch email per lead these line up.

-- Per-campaign rollup for the campaigns overview table.
create or replace view bn_campaign_stats as
select
  c.id                                                            as campaign_id,
  c.name,
  c.description,
  c.status,
  c.tracking_enabled,
  c.created_at,
  (select count(*) from bn_leads l where l.campaign_id = c.id)    as assigned,
  count(s.id) filter (where s.status = 'sent')                    as sent,
  count(s.id) filter (where s.delivered_at is not null)           as delivered,
  count(distinct s.lead_id) filter (where s.open_count > 0)       as opened,
  coalesce(sum(s.open_count), 0)                                  as open_events,
  count(distinct s.lead_id) filter (where s.click_count > 0)      as clicked,
  coalesce(sum(s.click_count), 0)                                 as click_events,
  count(s.id) filter (where s.status = 'bounced')                 as bounced,
  count(s.id) filter (where s.complained_at is not null)          as complained
from bn_campaigns c
left join bn_email_sequences s on s.campaign_id = c.id
group by c.id;

-- One aggregate for a single campaign, or for everything (p_campaign = null).
-- Powers the dashboard KPI row (overall) and each campaign's detail header.
create or replace function bn_analytics(p_campaign uuid default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'sent',       count(s.id) filter (where s.status = 'sent'),
    'delivered',  count(s.id) filter (where s.delivered_at is not null),
    'opened',     count(distinct s.lead_id) filter (where s.open_count > 0),
    'openEvents', coalesce(sum(s.open_count), 0),
    'clicked',    count(distinct s.lead_id) filter (where s.click_count > 0),
    'clickEvents',coalesce(sum(s.click_count), 0),
    'bounced',    count(s.id) filter (where s.status = 'bounced'),
    'complained', count(s.id) filter (where s.complained_at is not null)
  )
  from bn_email_sequences s
  where p_campaign is null or s.campaign_id = p_campaign;
$$;
