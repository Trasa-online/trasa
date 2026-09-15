-- Jeden wlasciciel, KILKA lokali (prosba Nat 2026-09-15).
--
-- Baza byla na to gotowa od poczatku: `owner_user_id` nigdy nie mial unikalnosci, a jedyny
-- unikalny klucz to `place_id` (jedno miejsce = jedna wizytowka, i tak ma zostac).
-- Blokada siedziala w APLIKACJI: redirect po zalogowaniu czytal wizytowke przez `maybeSingle()`
-- (przy dwoch wierszach PostgREST zwraca BLAD, wiec wlasciciel dwoch lokali nie trafialby
-- do panelu wcale), a `register-business` przy istniejacym koncie oddawal pierwsza wizytowke
-- zamiast zalozyc kolejna.
--
-- Te dwie funkcje daja panelowi to, czego mu brakowalo: LISTE lokali wlasciciela i sposob
-- na dolozenie nastepnego bez przechodzenia przez rejestracje mailowa.

-- ── Lista lokali zalogowanego wlasciciela ──────────────────────────────────
-- ⚠️ `business_profiles` ma KOLUMNOWE granty SELECT, wiec klient nie zrobi `select("*")`.
-- Funkcja oddaje dokladnie te pola, ktorych potrzebuje przelacznik lokali - nic wiecej.
create or replace function public.my_business_profiles()
returns table (
  id uuid,
  place_id uuid,
  business_name text,
  city text,
  logo_url text,
  cover_image_url text,
  is_draft boolean,
  is_active boolean,
  moderation_status text,
  plan text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select bp.id, bp.place_id, bp.business_name, bp.city, bp.logo_url, bp.cover_image_url,
         bp.is_draft, bp.is_active, bp.moderation_status, bp.plan, bp.created_at
    from public.business_profiles bp
   where auth.uid() is not null
     and bp.owner_user_id = auth.uid()
   order by bp.created_at asc;
$$;

revoke all on function public.my_business_profiles() from public, anon;
grant execute on function public.my_business_profiles() to authenticated;

comment on function public.my_business_profiles() is
  'Lokale zalogowanego wlasciciela - zrodlo przelacznika lokali w panelu.';

-- ── Dolozenie kolejnego lokalu ─────────────────────────────────────────────
-- ⛔ Funkcja NIE zaklada konta i nie wysyla maili - to jest wylacznie "mam juz lokal
-- w spontaway i chce dodac drugi". Dlatego wymaga, zeby wolajacy JUZ byl wlascicielem
-- co najmniej jednej wizytowki: inaczej byloby to drugie, nieuwierzytelnione wejscie
-- na rejestracje biznesu (pierwszy lokal zaklada `register-business` z linkiem z maila).
create or replace function public.create_additional_business(
  p_name  text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_uid   uuid := auth.uid();
  v_owned int;
  v_recent int;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;
  if v_name is null then
    raise exception 'Nazwa lokalu jest wymagana';
  end if;

  select count(*) into v_owned from public.business_profiles where owner_user_id = v_uid;
  if v_owned = 0 then
    raise exception 'Najpierw zaloz pierwszy lokal';
  end if;
  -- Bezpiecznik: ktos z dostepem do konta nie zasypie nam bazy wizytowkami.
  if v_owned >= 20 then
    raise exception 'Osiagnieto limit 20 lokali na konto. Napisz do nas, jesli potrzebujesz wiecej.';
  end if;

  select count(*) into v_recent
    from public.business_profiles
   where owner_user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 3 then
    raise exception 'Za duzo lokali naraz. Sprobuj za godzine.';
  end if;

  insert into public.business_profiles (owner_user_id, business_name, phone, is_draft, is_active, plan)
  values (v_uid, left(v_name, 80), nullif(left(coalesce(p_phone, ''), 40), ''), false, false, 'zero')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_additional_business(text, text) from public, anon;
grant execute on function public.create_additional_business(text, text) to authenticated;

comment on function public.create_additional_business(text, text) is
  'Kolejny lokal dla wlasciciela, ktory ma juz przynajmniej jeden. Max 20 na konto, 3 na godzine.';
