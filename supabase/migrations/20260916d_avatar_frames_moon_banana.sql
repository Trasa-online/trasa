-- Trzy nowe nakladki awatara (prosba Nat 2026-09-16): ksiezyc, ksiezyc z gwiazdkami, banan.
--
-- ⚠️ DWA miejsca w bazie, nie jedno. Sama zmiana CHECK-a NIE wystarczy: zapis przechodzi
-- jeszcze przez trigger `guard_avatar_frame`, ktory pyta `frame_unlocked(uid, frame)`, a ta
-- funkcja konczy sie `return false` - czyli ODRZUCA wszystko, czego nie wymieniono w srodku.
-- Nowa nakladka bez dopisania tutaj wyglada w apce jak blad zapisu (`frame_locked`).
--
-- Nowe nakladki sa DARMOWE (nie `reward`), wiec wchodza do tej samej galezi, co gwiazdki,
-- serduszka i chmurki. Tecza zostaje jedyna nagroda za zaproszenia.

alter table public.profiles drop constraint if exists profiles_avatar_frame_check;
alter table public.profiles
  add constraint profiles_avatar_frame_check
  check (avatar_frame is null or avatar_frame in
    ('stars', 'hearts', 'clouds', 'moon', 'moonstars', 'banana', 'rainbow'));

create or replace function public.frame_unlocked(p_user uuid, p_frame text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_goal constant int := 3;   -- = REFERRAL_GOAL w src/lib/referral.ts
begin
  if p_frame is null or p_frame in ('stars', 'hearts', 'clouds', 'moon', 'moonstars', 'banana') then return true; end if;
  if p_frame = 'rainbow' then
    if exists (select 1 from public.frame_grants g where g.user_id = p_user and g.frame = 'rainbow') then return true; end if;
    return (select count(*) from public.profiles r where r.referred_by = p_user) >= v_goal;
  end if;
  return false;
end;
$function$;
