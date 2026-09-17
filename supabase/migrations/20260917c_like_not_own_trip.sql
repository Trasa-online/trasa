-- NIE POLUBISZ WLASNEGO WYJAZDU (decyzja Nat 2026-09-17).
--
-- Autor i wspoluczestnik nie moga polubic wyjazdu, ktory wspoltworza - moga wylacznie zobaczyc,
-- kto go polubil. Do tej pory polityka INSERT sprawdzala tylko `auth.uid() = user_id`, wiec
-- wlasciciel mogl podbic sobie licznik.
--
-- ⚠️ Bramka stoi w BAZIE, nie tylko w UI. Regula z audytow: filtr stawiamy w obu miejscach,
-- bo RLS odpowiada na pytanie "czy wolno mi to zapisac", a nie "czy guzik jest widoczny".
-- Tu wyjatkowo triggerem, nie polityka: polityka moglaby to zrobic, ale odrzucenie wyszloby
-- jako puste 0 wierszy bez powodu, a trigger daje nazwany blad, ktory klient umie pokazac.
--
-- ⛔ ISTNIEJACYCH wierszy NIE kasujemy. W chwili wdrozenia bylo ich 6 z 21 (2 wlascicieli,
-- 4 uczestnikow) i to sa polubienia, ktore naprawde padly - pod wczesniejsza regula. Skasowanie
-- obnizyloby liczniki widoczne dla innych userow, wiec to decyzja Nat, nie skutek uboczny
-- migracji. Do sprzatniecia jednym DELETE, gdy zdecyduje.

create or replace function public.guard_like_not_own_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.routes r
    where r.id = NEW.route_id
      and (
        r.user_id = NEW.user_id
        or (r.group_session_id is not null and exists (
              select 1 from public.group_session_members m
              where m.session_id = r.group_session_id and m.user_id = NEW.user_id))
      )
  ) then
    raise exception 'own_trip_like' using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_likes_not_own_trip on public.likes;
create trigger trg_likes_not_own_trip
  before insert on public.likes
  for each row execute function public.guard_like_not_own_trip();

revoke execute on function public.guard_like_not_own_trip() from public, anon, authenticated;
