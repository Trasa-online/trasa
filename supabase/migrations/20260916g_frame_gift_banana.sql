-- BANAN takze jako PREZENT - tym razem dla @maria (prosba Nat 2026-09-16).
--
-- Do tej pory banan byl darmowy dla wszystkich (migracja 20260916d). Nie zdazyl trafic
-- do zadnego builda, wiec nikt go jeszcze nie widzial i nie ma czego odbierac.
--
-- ⚠️ `my_frame_gift` przestaje byc zaszyte na 'moonstars' i pyta o LISTE nakladek-prezentow.
-- Lista musi sie zgadzac z `gift: true` w src/lib/avatarFrames.ts - to jedyne dwa miejsca,
-- gdzie zyje ta wiedza. ⛔ Nie wrzucaj tu `rainbow`: to NAGRODA do zdobycia, a nie prezent,
-- i ma swoj grant u zalozycielki - modal z podziekowaniem wyskoczylby jej za teczę.

create or replace function public.frame_unlocked(p_user uuid, p_frame text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_goal constant int := 3;   -- = REFERRAL_GOAL w src/lib/referral.ts
begin
  if p_frame is null or p_frame in ('stars', 'hearts', 'clouds', 'moon') then return true; end if;
  -- PREZENTY: bez sciezki "zaproś i zdobądź" - liczy sie sam grant.
  if p_frame in ('moonstars', 'banana') then
    return exists (select 1 from public.frame_grants g where g.user_id = p_user and g.frame = p_frame);
  end if;
  if p_frame = 'rainbow' then
    if exists (select 1 from public.frame_grants g where g.user_id = p_user and g.frame = 'rainbow') then return true; end if;
    return (select count(*) from public.profiles r where r.referred_by = p_user) >= v_goal;
  end if;
  return false;
end;
$function$;

create or replace function public.my_frame_gift()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select g.frame from public.frame_grants g
   where g.user_id = auth.uid() and g.gift_seen_at is null
     and g.frame in ('moonstars', 'banana')
   order by g.granted_at limit 1;
$function$;

insert into public.frame_grants (user_id, frame, note) values
  ('79ac90fd-177a-4030-9d22-97d75bdfdac9', 'banana', 'maria - prezent 2026-09-16')
on conflict do nothing;
