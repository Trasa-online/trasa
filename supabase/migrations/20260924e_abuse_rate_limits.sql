-- BEZPIECZNIKI PRZED NADUZYCIEM W APLIKACJI (audyt 2026-09-24, prosba Nat).
--
-- Limity miejsc w planie (100) i w kolekcji (30) sa od 2026-09-20, ale reszta zapisow byla
-- BEZ zadnego sufitu: mozna bylo skryptem zalozyc dziesiec tysiecy planow, wrzucic sto tysiecy
-- wierszy do prywatnej „Ogolne", albo - najgorsze - zaobserwowac tysiac osob w minute, bo
-- KAZDA obserwacja wysyla drugiej osobie powiadomienie i push. To nie jest koszt Google,
-- tylko spam do ludzi i puchnaca baza.
--
-- ⚠️ To sa bezpieczniki od UCIECZKI, nie limity produktowe. Progi stoja rzad wielkosci nad
-- realnym uzyciem (najaktywniejsze konto ma dzis 53 miejsca w „Ogolne" i 46 planow LACZNIE),
-- wiec zwykly user nigdy ich nie zobaczy. Jesli ktorys zacznie przeszkadzac - podnies go
-- swiadomie, razem z decyzja, ile taki ruch kosztuje.
--
-- ⛔ Licznik jest ten sam, co przy funkcjach brzegowych (`fn_rate_limit`), wiec nie ma tu
-- nowej tabeli ani nowego mechanizmu do pilnowania.

CREATE OR REPLACE FUNCTION public.guard_user_rate(p_kind text, p_limit integer, p_window_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_uid uuid := auth.uid();
  v_start timestamptz;
  v_hits integer;
begin
  -- Bez JWT (wyzwalacze systemowe, service_role, cron) nie liczymy niczego.
  if v_uid is null then return; end if;
  v_start := to_timestamp(
    floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );
  insert into public.fn_rate_limit (bucket, window_start, hits)
  values ('u:' || p_kind || ':' || v_uid::text, v_start, 1)
  on conflict (bucket, window_start) do update set hits = fn_rate_limit.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'rate_limited' using hint = p_kind, errcode = 'check_violation';
  end if;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_user_rate(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- ── Wyzwalacze ────────────────────────────────────────────────────────────────────────
-- Kazdy liczy WIERSZE WSTAWIONE przez zalogowanego uzytkownika w oknie czasu.
-- ⚠️ Progi dla pozycji kolekcji i pinow sa WYSOKIE (2000/dobe), bo edycja kolekcji kasuje
-- i wstawia WSZYSTKIE pozycje od nowa (`CreateRanking`), a zapis planu robi to samo z pinami -
-- czyli jedna zmiana kolejnosci to kilkadziesiat wstawien. Limit ma lapac skrypt, nie edycje.

CREATE OR REPLACE FUNCTION public.rl_routes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('routes', 100, 1440); return new; end $$;

CREATE OR REPLACE FUNCTION public.rl_collections() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('collections', 100, 1440); return new; end $$;

CREATE OR REPLACE FUNCTION public.rl_items() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('items', 2000, 1440); return new; end $$;

CREATE OR REPLACE FUNCTION public.rl_pins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('pins', 2000, 1440); return new; end $$;

CREATE OR REPLACE FUNCTION public.rl_place_photos() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('photos', 300, 1440); return new; end $$;

-- ⚠️ Obserwacje i zaproszenia do znajomych maja okno GODZINOWE, nie dobowe: tu chodzi nie
-- o baze, tylko o POWIADOMIENIA wysylane innym ludziom. Sto obserwacji na godzine to i tak
-- wielokrotnie wiecej, niz robi czlowiek.
CREATE OR REPLACE FUNCTION public.rl_follows() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('follows', 100, 60); return new; end $$;

CREATE OR REPLACE FUNCTION public.rl_friend_requests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('friend_req', 50, 60); return new; end $$;

CREATE OR REPLACE FUNCTION public.rl_trip_messages() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin perform public.guard_user_rate('messages', 300, 60); return new; end $$;

DROP TRIGGER IF EXISTS trg_rl_routes ON public.routes;
CREATE TRIGGER trg_rl_routes BEFORE INSERT ON public.routes FOR EACH ROW EXECUTE FUNCTION public.rl_routes();

DROP TRIGGER IF EXISTS trg_rl_collections ON public.discovery_collections;
CREATE TRIGGER trg_rl_collections BEFORE INSERT ON public.discovery_collections FOR EACH ROW EXECUTE FUNCTION public.rl_collections();

DROP TRIGGER IF EXISTS trg_rl_items ON public.discovery_items;
CREATE TRIGGER trg_rl_items BEFORE INSERT ON public.discovery_items FOR EACH ROW EXECUTE FUNCTION public.rl_items();

DROP TRIGGER IF EXISTS trg_rl_pins ON public.pins;
CREATE TRIGGER trg_rl_pins BEFORE INSERT ON public.pins FOR EACH ROW EXECUTE FUNCTION public.rl_pins();

DROP TRIGGER IF EXISTS trg_rl_place_photos ON public.place_photos;
CREATE TRIGGER trg_rl_place_photos BEFORE INSERT ON public.place_photos FOR EACH ROW EXECUTE FUNCTION public.rl_place_photos();

DROP TRIGGER IF EXISTS trg_rl_follows ON public.followers;
CREATE TRIGGER trg_rl_follows BEFORE INSERT ON public.followers FOR EACH ROW EXECUTE FUNCTION public.rl_follows();

DROP TRIGGER IF EXISTS trg_rl_friend_requests ON public.friendships;
CREATE TRIGGER trg_rl_friend_requests BEFORE INSERT ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.rl_friend_requests();

DROP TRIGGER IF EXISTS trg_rl_trip_messages ON public.trip_messages;
CREATE TRIGGER trg_rl_trip_messages BEFORE INSERT ON public.trip_messages FOR EACH ROW EXECUTE FUNCTION public.rl_trip_messages();
