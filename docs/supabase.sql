-- Partage des coches entre téléphone et ordinateur (Supabase, offre gratuite).
-- À coller une fois dans Supabase : SQL Editor > New query > coller > Run.
--
-- Principe : pas de connexion par e-mail. L'appli crée un « code de partie » secret
-- (24 caractères au hasard) ; qui connaît le code lit et écrit la partie, personne d'autre.
-- La table est fermée à la lecture directe : on n'y passe que par les deux fonctions.

create table if not exists parties (
  code text primary key check (length(code) >= 24),
  etat jsonb not null,
  modifie timestamptz not null default now()
);

alter table parties enable row level security;
-- aucune règle d'accès : la clé publique de l'appli ne peut ni lister ni lire la table

create or replace function lire_partie(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select etat from parties where code = p_code;
$$;

create or replace function ecrire_partie(p_code text, p_etat jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_code) < 24 then
    raise exception 'code trop court';
  end if;
  if pg_column_size(p_etat) > 200000 then
    raise exception 'partie trop grosse';
  end if;
  insert into parties (code, etat, modifie) values (p_code, p_etat, now())
  on conflict (code) do update set etat = excluded.etat, modifie = now();
end;
$$;

revoke all on function lire_partie(text) from public;
revoke all on function ecrire_partie(text, jsonb) from public;
grant execute on function lire_partie(text) to anon;
grant execute on function ecrire_partie(text, jsonb) to anon;
