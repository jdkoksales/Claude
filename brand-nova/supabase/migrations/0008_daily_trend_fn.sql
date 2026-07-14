-- Daily event counts for the trend chart, gap-filled so every day in the
-- window is present (zeros included). Optionally scoped to one campaign.
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
  group by d
  order by d;
$$;
