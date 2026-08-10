-- Foto's staan bewust NIET in samen.store: die ene JSONB-rij wordt bij elk
-- verzoek geladen, en met plaatjes erin zou dat onwerkbaar worden. Hier alleen
-- de ruwe bytes; wie hem plaatste en bij welk album hij hoort staan als lichte
-- metagegevens wel in de store, zodat een lijstje tonen geen tabel hoeft te raken.
create table if not exists samen.photo_data (
  id         text primary key,
  mime       text not null,
  bytes      bytea not null,
  created_at timestamptz not null default now()
);

comment on table samen.photo_data is
  'Ruwe afbeeldingen van de Samen-app. Metagegevens staan in samen.store.';

revoke all on schema samen from anon, authenticated;
revoke all on all tables in schema samen from anon, authenticated;
