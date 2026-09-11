-- Nakladka "rainbow" (teczowy, swiecacy pierscien) - NAGRODA za zaproszenia (prosba Nat
-- 2026-09-11): dostepna po zaproszeniu REFERRAL_GOAL (3) osob albo z jawnego grantu.
--
-- Egzekwowanie jest W BAZIE, nie tylko w UI: bez tego kazdy moglby ustawic
-- avatar_frame='rainbow' jednym PATCH-em przez REST. Trigger BEFORE UPDATE/INSERT odrzuca
-- zablokowana nakladke. Reguly zyja w jednej funkcji (frame_unlocked), z ktorej korzysta
-- tez RPC my_frame_unlocks() dla arkusza w Ustawieniach.

-- 1) Nowa wartosc w CHECK.
alter table public.profiles drop constraint if exists profiles_avatar_frame_check;
alter table public.profiles
  add constraint profiles_avatar_frame_check
  check (avatar_frame is null or avatar_frame in ('stars', 'hearts', 'clouds', 'rainbow'));

-- 2) Jawne granty (np. zalozycielka, przyszle konkursy). Tylko admin / SQL pisze.
create table if not exists public.frame_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  frame      text not null,
  granted_at timestamptz not null default now(),
  note       text null,
  primary key (user_id, frame)
);
alter table public.frame_grants enable row level security;
drop policy if exists "frame_grants: own read" on public.frame_grants;
create policy "frame_grants: own read" on public.frame_grants for select to authenticated using (auth.uid() = user_id);
grant select on public.frame_grants to authenticated;

-- 3) Regula odblokowania (SECURITY DEFINER, bo liczy po profiles.referred_by i frame_grants).
create or replace function public.frame_unlocked(p_user uuid, p_frame text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_goal constant int := 3;   -- = REFERRAL_GOAL w src/lib/referral.ts
begin
  if p_frame is null or p_frame in ('stars', 'hearts', 'clouds') then return true; end if;
  if p_frame = 'rainbow' then
    if exists (select 1 from public.frame_grants g where g.user_id = p_user and g.frame = 'rainbow') then return true; end if;
    return (select count(*) from public.profiles r where r.referred_by = p_user) >= v_goal;
  end if;
  return false;
end;
$$;
revoke all on function public.frame_unlocked(uuid, text) from public, anon;
grant execute on function public.frame_unlocked(uuid, text) to authenticated;

-- 4) Trigger: nie da sie zapisac zablokowanej nakladki.
create or replace function public.guard_avatar_frame()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.avatar_frame is distinct from old.avatar_frame and not public.frame_unlocked(new.id, new.avatar_frame) then
    raise exception 'frame_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_avatar_frame on public.profiles;
create trigger profiles_guard_avatar_frame
  before update of avatar_frame on public.profiles
  for each row execute function public.guard_avatar_frame();

-- 5) RPC dla arkusza: ktore nakladki mam odblokowane + postep zaproszen.
create or replace function public.my_frame_unlocks()
returns table (frame text, unlocked boolean, invited integer, goal integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_invited int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  select count(*)::int into v_invited from public.profiles r where r.referred_by = v_me;
  return query
    select f.frame, public.frame_unlocked(v_me, f.frame), v_invited, 3
    from (values ('stars'), ('hearts'), ('clouds'), ('rainbow')) as f(frame);
end;
$$;
revoke all on function public.my_frame_unlocks() from public, anon;
grant execute on function public.my_frame_unlocks() to authenticated;

-- 6) Grant dla zalozycielki (prosba Nat: "odblokuj ja tylko dla mnie").
insert into public.frame_grants (user_id, frame, note)
select u.id, 'rainbow', 'zalozycielka - odblokowane recznie 2026-09-11'
from auth.users u where lower(u.email) = 'nat.maz98@gmail.com'
on conflict (user_id, frame) do nothing;
