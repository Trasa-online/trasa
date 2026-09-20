-- Limity liczby miejsc (decyzja Nat 2026-09-20): wyjazd max 100 miejsc, kolekcja max 30.
-- Egzekwowane W BAZIE (regula z audytow: filtr w obu miejscach) - klient sprawdza tylko po to,
-- zeby nie wysylac zapytania skazanego na blad. Blad `place_limit` klient mapuje na toast.
--
-- ⚠️ Prywatna „Ogolne" (list_status = 'to_visit') NIE ma limitu: to wishlista, do ktorej wpada
-- kazde „Zapisz" - na prodzie w dniu wdrozenia dwie mialy 37 i 41 pozycji. Limit dotyczy
-- kolekcji kuratorskich (`visited`). Trigger liczy STAN + nowe wiersze w tej samej instrukcji
-- (statement-level, transition table), wiec wsadowy insert 40 miejsc do pustej kolekcji tez
-- jest odrzucony, a nie przepuszczony po jednym.

create or replace function public.guard_route_pin_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit constant int := 100;
  r record;
begin
  for r in
    select n.route_id, count(*) as adding
    from new_rows n
    group by n.route_id
  loop
    if (select count(*) from public.pins p where p.route_id = r.route_id) > v_limit then
      raise exception 'place_limit' using
        detail = format('route %s exceeds %s places', r.route_id, v_limit),
        hint = 'trip_places';
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_pins_place_limit on public.pins;
create trigger trg_pins_place_limit
  after insert on public.pins
  referencing new table as new_rows
  for each statement
  execute function public.guard_route_pin_limit();

create or replace function public.guard_collection_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit constant int := 30;
  r record;
begin
  for r in
    select n.collection_id
    from new_rows n
    group by n.collection_id
  loop
    -- Prywatna wishlista „Ogolne" bez limitu (patrz naglowek pliku).
    if exists (
      select 1 from public.discovery_collections c
      where c.id = r.collection_id and c.list_status = 'to_visit'
    ) then
      continue;
    end if;
    if (select count(*) from public.discovery_items i where i.collection_id = r.collection_id) > v_limit then
      raise exception 'place_limit' using
        detail = format('collection %s exceeds %s places', r.collection_id, v_limit),
        hint = 'collection_places';
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_discovery_items_place_limit on public.discovery_items;
create trigger trg_discovery_items_place_limit
  after insert on public.discovery_items
  referencing new table as new_rows
  for each statement
  execute function public.guard_collection_item_limit();

-- Funkcje wyzwalaczy: nikt nie wola ich z klienta.
revoke execute on function public.guard_route_pin_limit() from public, anon, authenticated;
revoke execute on function public.guard_collection_item_limit() from public, anon, authenticated;
