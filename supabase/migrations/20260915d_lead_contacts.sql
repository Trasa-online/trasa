-- Kontakt do leada (prosba Nat 2026-09-15): panel ma umiec sam znalezc adres mailowy
-- lokalu, ktory userzy dodaja do kolekcji, ale ktory nie ma jeszcze konta w spontaway.
--
-- ⚠️ Google Places NIE zwraca adresow e-mail - ma wylacznie strone i telefon. Mail bierze
-- sie wiec ze STRONY lokalu (mailto: i tresc podstron kontaktowych), a to bywa nieskuteczne:
-- czesc lokali ma tylko formularz albo Instagram. Dlatego tabela trzyma `status` i pozwala
-- wpisac adres RECZNIE - polowa tej pracy i tak zostanie ludzka.
--
-- Klucz miejsca = znormalizowana nazwa (ta sama zasada co `place_photos` / notki o miejscu),
-- bo piny trzymaja nazwe, nie uuid. Miasto rozdziela sieciowki o tej samej nazwie.

create table if not exists public.lead_contacts (
  id          uuid primary key default gen_random_uuid(),
  place_key   text not null,                    -- lower(trim(place_name))
  place_name  text not null,
  city        text,
  website     text,
  phone       text,
  email       text,                             -- adres wybrany do kontaktu
  emails      text[] not null default '{}',     -- wszyscy kandydaci ze strony
  source_url  text,                             -- podstrona, z ktorej wyszedl mail
  found_by    text,                             -- 'website' | 'google' | 'manual'
  status      text not null default 'new',      -- 'new' | 'found' | 'not_found' | 'contacted'
  note        text,
  checked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint lead_contacts_status_chk check (status in ('new','found','not_found','contacted')),
  constraint lead_contacts_found_by_chk check (found_by is null or found_by in ('website','google','manual'))
);

-- Jeden wiersz na (nazwa, miasto). `coalesce` w indeksie, bo NULL nie rowna sie NULL.
create unique index if not exists lead_contacts_key_city_idx
  on public.lead_contacts (place_key, coalesce(city, ''));

alter table public.lead_contacts enable row level security;

-- Dane kontaktowe firm widzi WYLACZNIE admin panelu. Edge function chodzi jako
-- service_role, ktore RLS pomija.
drop policy if exists lead_contacts_admin_all on public.lead_contacts;
create policy lead_contacts_admin_all on public.lead_contacts
  for all to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create or replace function public.lead_contacts_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lead_contacts_touch_trg on public.lead_contacts;
create trigger lead_contacts_touch_trg before update on public.lead_contacts
  for each row execute function public.lead_contacts_touch();

comment on table public.lead_contacts is
  'Kontakty do lokali bez konta (leady). Mail pochodzi ze strony lokalu - Google Places go nie zwraca.';
