-- Analytics count ONLY tracked sends. Untracked sends (the early warmup batch,
-- and any campaign with tracking off) carry no open pixel or click redirect, so
-- they can never register opens/clicks — counting them as sent/delivered drags
-- every rate artificially down. Tracked-only keeps the rates honest.

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
  where s.tracked = true
    and (p_campaign is null or s.campaign_id = p_campaign);
$$;

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
left join bn_email_sequences s on s.campaign_id = c.id and s.tracked = true
group by c.id;

create or replace function bn_daily_trend(p_days int default 14, p_campaign uuid default null)
returns table(day date, sent bigint, delivered bigint, opened bigint, clicked bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    d::date                                                as day,
    count(e.id) filter (where e.type = 'sent')             as sent,
    count(e.id) filter (where e.type = 'delivered')        as delivered,
    count(e.id) filter (where e.type = 'opened')           as opened,
    count(e.id) filter (where e.type = 'clicked')          as clicked
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join bn_email_events e
    on e.occurred_at >= d
   and e.occurred_at < d + interval '1 day'
   and (p_campaign is null or e.campaign_id = p_campaign)
   and e.email_sequence_id in (select id from bn_email_sequences where tracked = true)
  group by d
  order by d;
$$;
