-- Alles van de Samen-app in een eigen schema, zodat het losstaat van wat er
-- verder in de database zit. Weghalen kan met: drop schema samen cascade;
create schema if not exists samen;

-- De hele inhoud van de app als één JSONB-rij. Voor twee mensen met afspraken,
-- doelen en taken is dat ruim voldoende, en schrijvers pakken bij een wijziging
-- een rijvergrendeling zodat ze elkaar niet overschrijven.
create table if not exists samen.store (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table samen.store is
  'Gedeelde agenda, doelen en taken van de Samen-app. Eén rij (id = 1).';

-- Dit schema hangt niet aan de Supabase-API en is alleen te benaderen met de
-- databaseverbinding van de app zelf.
revoke all on schema samen from anon, authenticated;
revoke all on all tables in schema samen from anon, authenticated;
