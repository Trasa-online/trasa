-- Zapytania ofertowe od lokali z landingu B2C (prosba Nat 2026-09-15).
--
-- Kontekst: landingu dla firm jeszcze nie ma, a sciezka "Dla firm" na landingu
-- konsumenckim prowadzila donikad (zalozenie konta + strona, ktorej nie ma). Zamiast
-- tego jeden guzik "Skontaktuj sie" otwiera formularz z zapytaniem o oferte, a zapytanie
-- laduje tutaj. To NIE jest to samo co `lead_contacts` - tam trafiaja lokale, ktore MY
-- znajdujemy i zaczepiamy; tu zglasza sie lokal sam.
--
-- Wiersze wstawia WYLACZNIE funkcja brzegowa `business-inquiry` (service_role), bo tylko
-- tam da sie zrobic limit czestotliwosci i walidacje. Anon NIE ma polityki INSERT - bez
-- niej formularz wystawiony na swiat bylby otwartym wpisem do bazy.

create table if not exists public.business_inquiries (
  id            uuid primary key default gen_random_uuid(),
  venue_name    text not null,
  city          text,
  contact_name  text,
  email         text not null,
  phone         text,
  message       text,
  language      text not null default 'pl',
  source        text not null default 'landing_b2c',
  status        text not null default 'new',   -- 'new' | 'contacted' | 'done' | 'spam'
  note          text,                          -- notatka admina
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint business_inquiries_status_chk check (status in ('new','contacted','done','spam')),
  constraint business_inquiries_language_chk check (language in ('pl','en'))
);

create index if not exists business_inquiries_created_idx
  on public.business_inquiries (created_at desc);
create index if not exists business_inquiries_status_idx
  on public.business_inquiries (status, created_at desc);

alter table public.business_inquiries enable row level security;

-- Dane kontaktowe firm widzi wylacznie admin panelu (ta sama zasada co `lead_contacts`).
drop policy if exists business_inquiries_admin_all on public.business_inquiries;
create policy business_inquiries_admin_all on public.business_inquiries
  for all to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create or replace function public.business_inquiries_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_inquiries_touch_trg on public.business_inquiries;
create trigger business_inquiries_touch_trg before update on public.business_inquiries
  for each row execute function public.business_inquiries_touch();

comment on table public.business_inquiries is
  'Zapytania o oferte od lokali (guzik „Skontaktuj sie" na landingu B2C). Wstawia funkcja business-inquiry.';
