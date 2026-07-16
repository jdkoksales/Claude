-- Bel-nu-signaal: when a prospect opens/clicks, alert the operator instantly
-- so the call happens while the mail is literally on the prospect's screen
-- (MIT/InsideSales: contact within 5 min = 21x more qualifications vs 30 min).
-- last_hot_alert_at rate-limits to one alert per lead per ~20h.

alter table bn_leads add column if not exists last_hot_alert_at timestamptz;
alter table bn_settings add column if not exists hot_alert_email boolean not null default true;
