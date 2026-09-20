-- PREZENT: nakladka "ksiezyc i gwiazdki" tylko dla dwoch osob (prosba Nat 2026-09-16).
--
-- Rozroznienie, ktore tu wchodzi:
--   `rainbow`   = NAGRODA - kazdy moze ja zdobyc, zapraszajac 3 osoby. Widac ja na liscie
--                 od poczatku, z kłodka i postepem "0 z 3" - to zachęta.
--   `moonstars` = PREZENT - nie da sie jej zdobyc niczym. Odblokowuje WYLACZNIE wpis
--                 w `frame_grants`. Dlatego arkusz CHOWA ja przed wszystkimi innymi:
--                 kłodka bez zadnej drogi do odblokowania to tylko frustracja.
--
-- `gift_seen_at` pilnuje, zeby modal z podziekowaniem pokazal sie RAZ. Swiadomie w bazie,
-- a nie w localStorage: prezent ma byc jednorazowym momentem takze po reinstalacji apki
-- i na drugim urzadzeniu.

alter table public.frame_grants add column if not exists gift_seen_at timestamptz;

-- ── frame_unlocked: moonstars wchodzi jako grant-only ──────────────────────────────────
create or replace function public.frame_unlocked(p_user uuid, p_frame text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_goal constant int := 3;   -- = REFERRAL_GOAL w src/lib/referral.ts
begin
  if p_frame is null or p_frame in ('stars', 'hearts', 'clouds', 'moon', 'banana') then return true; end if;
  -- PREZENT: bez sciezki "zaproś i zdobądź" - liczy sie sam grant.
  if p_frame = 'moonstars' then
    return exists (select 1 from public.frame_grants g where g.user_id = p_user and g.frame = 'moonstars');
  end if;
  if p_frame = 'rainbow' then
    if exists (select 1 from public.frame_grants g where g.user_id = p_user and g.frame = 'rainbow') then return true; end if;
    return (select count(*) from public.profiles r where r.referred_by = p_user) >= v_goal;
  end if;
  return false;
end;
$function$;

-- ── my_frame_unlocks: lista MUSI wymieniac wszystkie nakladki, inaczej arkusz nie wie,
--    czy dana pozycja jest zablokowana (brak wiersza = brak informacji) ──────────────────
create or replace function public.my_frame_unlocks()
returns table(frame text, unlocked boolean, invited integer, goal integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_invited int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  select count(*)::int into v_invited from public.profiles r where r.referred_by = v_me;
  return query
    select f.frame, public.frame_unlocked(v_me, f.frame), v_invited, 3
    from (values ('stars'), ('hearts'), ('clouds'), ('moon'), ('moonstars'), ('banana'), ('rainbow')) as f(frame);
end;
$function$;

-- ── Nieodebrany prezent: co pokazac w modalu i jak go zamknac na dobre ─────────────────
create or replace function public.my_frame_gift()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select g.frame from public.frame_grants g
   where g.user_id = auth.uid() and g.gift_seen_at is null and g.frame = 'moonstars'
   order by g.granted_at limit 1;
$function$;

create or replace function public.mark_frame_gift_seen(p_frame text)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $function$
  update public.frame_grants set gift_seen_at = now()
   where user_id = auth.uid() and frame = p_frame and gift_seen_at is null;
$function$;

-- Regula z audytu: SECDEF dostaje EXECUTE dla PUBLIC z automatu, wiec odbieramy i dajemy jawnie.
revoke execute on function public.my_frame_gift() from public, anon;
grant  execute on function public.my_frame_gift() to authenticated;
revoke execute on function public.mark_frame_gift_seen(text) from public, anon;
grant  execute on function public.mark_frame_gift_seen(text) to authenticated;

-- ── Sam prezent ───────────────────────────────────────────────────────────────────────
insert into public.frame_grants (user_id, frame, note) values
  ('e8e691a5-e622-437a-add6-7974b9634c8b', 'moonstars', 'zalozycielka - prezent 2026-09-16'),
  ('46592cfb-0f27-4b91-ad58-270324f47211', 'moonstars', 'msrebellefleur - podziekowanie za wsparcie, 2026-09-16')
on conflict do nothing;
