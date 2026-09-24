-- KODY QR NA WIZYTOWKACH DRUKOWANYCH DLA LOKALI (decyzja Nat 2026-09-21, na razie 1 kod testowy).
--
-- Jeden kod = jeden link `spontaway.com/q/<token>`, ktory robi DWIE rzeczy zaleznie od tego,
-- kto skanuje:
--  - PODROZNY: strona miejsca (jak /p/<id>) + universal link do apki -> wizytowka miejsca
--    z zapisem do kolekcji / planu; sam skan znaczy „jestem tu", wiec apka moze odhaczyc
--    odwiedziny bez GPS (place_visits.source = 'qr');
--  - LOKAL: guzik „To moj lokal" -> rejestracja B2B z tokenem; `register-business` przypina
--    token do wizytowki (`claimed_by_profile_id`), a jesli token wskazuje juz na miejsce
--    w stanie zero - podpina to miejsce (`place_id`) od razu, bez dopasowywania po nazwie.
--
-- Token jest LOSOWY (nie id miejsca), zeby nie dalo sie zgadnac cudzego. `place_id` moze byc
-- puste do czasu przypisania (Nat przypisuje reczne / przez rejestracje lokalu).

create table if not exists public.place_qr_codes (
  token                 text primary key,
  place_id              uuid references public.places(id) on delete set null,
  label                 text,
  claimed_by_profile_id uuid references public.business_profiles(id) on delete set null,
  claimed_at            timestamptz,
  scans                 integer not null default 0,
  last_scanned_at       timestamptz,
  created_at            timestamptz not null default now()
);
alter table public.place_qr_codes enable row level security;
-- Bez polityk: klient czyta WYLACZNIE przez `resolve_qr_code`, pisze tylko service_role
-- (funkcje brzegowe) i admin z panelu ops (SECDEF ponizej).
revoke all on public.place_qr_codes from public, anon, authenticated;

-- Skan: oddaje miejsce (gdy przypisane) i zlicza. Anon tez - kod skanuje sie przed logowaniem.
create or replace function public.resolve_qr_code(p_token text)
returns table(token text, place_id uuid, place_name text, city text, claimed boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_tok text := lower(btrim(coalesce(p_token, '')));
begin
  if v_tok = '' or length(v_tok) > 32 then return; end if;
  update public.place_qr_codes q
     set scans = q.scans + 1, last_scanned_at = now()
   where q.token = v_tok;
  return query
    select q.token, q.place_id, p.place_name, p.city, (q.claimed_by_profile_id is not null) as claimed
      from public.place_qr_codes q
      left join public.places p on p.id = q.place_id
     where q.token = v_tok;
end; $$;
revoke execute on function public.resolve_qr_code(text) from public;
grant execute on function public.resolve_qr_code(text) to anon, authenticated;

-- Admin (panel ops / SQL): utworz kod, opcjonalnie od razu z miejscem.
create or replace function public.create_qr_code(p_label text default null, p_place_id uuid default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_tok text; v_alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789'; i int;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'not_allowed'; end if;
  loop
    v_tok := '';
    for i in 1..8 loop
      v_tok := v_tok || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.place_qr_codes where token = v_tok);
  end loop;
  insert into public.place_qr_codes (token, label, place_id) values (v_tok, p_label, p_place_id);
  return v_tok;
end; $$;
revoke execute on function public.create_qr_code(text, uuid) from public, anon;
grant execute on function public.create_qr_code(text, uuid) to authenticated;

-- Skan zalogowanego = „jestem tu": odwiedziny bez GPS. Nowe zrodlo w CHECK-u `source`.
alter table public.place_visits drop constraint if exists place_visits_source_check;
alter table public.place_visits add constraint place_visits_source_check check (source in ('manual', 'trip', 'qr'));

-- Klucz miejsca liczony jak w apce
-- (`placeKeyOf`: gpid: albo nm:), zeby odhaczenie bylo widoczne w kazdej kolekcji.
create or replace function public.mark_qr_visit(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_pl record; v_key text;
begin
  if auth.uid() is null then return false; end if;
  select p.id, p.place_name, p.city, p.google_place_id into v_pl
    from public.place_qr_codes q join public.places p on p.id = q.place_id
   where q.token = lower(btrim(coalesce(p_token, '')));
  if v_pl.id is null then return false; end if;
  v_key := case when coalesce(btrim(v_pl.google_place_id), '') <> '' then 'gpid:' || btrim(v_pl.google_place_id)
                else 'nm:' || lower(btrim(coalesce(v_pl.place_name, ''))) end;
  insert into public.place_visits (user_id, place_key, place_name, city, source)
  values (auth.uid(), v_key, v_pl.place_name, v_pl.city, 'qr')
  on conflict do nothing;
  return true;
end; $$;
revoke execute on function public.mark_qr_visit(text) from public, anon;
grant execute on function public.mark_qr_visit(text) to authenticated;
