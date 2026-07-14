-- Let the live activity feed carry open/click events ("Garage Jansen opened
-- the email", "Restaurant De Brug clicked the Website Check").
alter table bn_activity_log drop constraint if exists bn_activity_log_type_check;
alter table bn_activity_log add constraint bn_activity_log_type_check
  check (type in (
    'analyzing','writing','sending','reading','learning',
    'followup','warm_lead','import','system','waiting','opened','clicked'
  ));
