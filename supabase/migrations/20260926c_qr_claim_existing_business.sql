-- KODY QR: przypiecie do ISTNIEJACEGO lokalu + podglad kodu w panelu (prosba Nat 2026-09-26).
--
-- Do tej pory kod przypinal sie wylacznie przy REJESTRACJI (`register-business` z `qr_token`).
-- Lokal, ktory juz ma konto, wchodzil z karty „To moj lokal" w logowanie i parametr `qr`
-- po prostu ginal. `claim_business_qr` robi to samo, co rejestracja, dla zalogowanego
-- wlasciciela. `my_business_qr_codes` zasila okno „Kod QR" w panelu lokalu.
--
-- place_qr_codes nie ma zadnych polityk - oba wejscia to SECDEF z jawnym sprawdzeniem
-- wlasnosci i EXECUTE wylacznie dla `authenticated` (regula z audytow).

create or replace function public.claim_business_qr(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bp record;
  v_qr record;
begin
  if v_uid is null then return 'not_signed_in'; end if;

  -- Wizytowka zalogowanego: najpierw prawdziwa, szkic dopiero gdy innej nie ma.
  select id, place_id into v_bp from business_profiles
    where owner_user_id = v_uid
    order by coalesce(is_draft, false), created_at
    limit 1;
  if v_bp.id is null then return 'no_profile'; end if;

  select token, place_id, claimed_by_profile_id into v_qr from place_qr_codes
    where token = lower(trim(p_token)) for update;
  if v_qr.token is null then return 'not_found'; end if;
  if v_qr.claimed_by_profile_id = v_bp.id then return 'already_yours'; end if;
  if v_qr.claimed_by_profile_id is not null then return 'taken'; end if;
  -- Kod wydrukowany dla INNEGO miejsca nie moze trafic do tego lokalu.
  if v_qr.place_id is not null and v_bp.place_id is not null and v_qr.place_id <> v_bp.place_id then
    return 'other_place';
  end if;

  update place_qr_codes
    set claimed_by_profile_id = v_bp.id,
        claimed_at = now(),
        place_id = coalesce(place_id, v_bp.place_id)
    where token = v_qr.token;

  -- Lustro register-business: wizytowka bez miejsca dostaje miejsce z kodu, o ile nikt go nie ma.
  if v_bp.place_id is null and v_qr.place_id is not null
     and not exists (select 1 from business_profiles where place_id = v_qr.place_id and id <> v_bp.id) then
    update business_profiles set place_id = v_qr.place_id where id = v_bp.id;
  end if;

  return 'claimed';
end;
$$;

create or replace function public.my_business_qr_codes(p_business_id uuid)
returns table (token text, label text, scans integer, last_scanned_at timestamptz, claimed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select q.token, q.label, q.scans, q.last_scanned_at, q.claimed_at
  from place_qr_codes q
  join business_profiles b on b.id = p_business_id
  where (b.owner_user_id = auth.uid() or has_role(auth.uid(), 'admin'))
    and (q.claimed_by_profile_id = b.id or (b.place_id is not null and q.place_id = b.place_id))
  order by q.created_at;
$$;

revoke execute on function public.claim_business_qr(text) from public, anon;
revoke execute on function public.my_business_qr_codes(uuid) from public, anon;
grant execute on function public.claim_business_qr(text) to authenticated;
grant execute on function public.my_business_qr_codes(uuid) to authenticated;
