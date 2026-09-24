-- SEKRET WYCIEKL DO REPO (zgloszenie GitGuardian, 2026-09-24) - usuwamy sam mechanizm.
--
-- W migracji `20260924d` licznik proxy obrazkow chronil TOKEN wpisany w `api/_quota.ts`.
-- Zalozenie bylo takie, ze katalog `api/` to kod serwerowy i nie trafia do przegladarki -
-- ale trafia do REPOZYTORIUM, a skaner sekretow slusznie to wylapal. Sekret w kodzie zostaje
-- sekretem tylko do pierwszego `git push`.
--
-- Co ten token chronil: WYLACZNIE licznik. Nie dawal dostepu do danych ani do platnych API -
-- najgorsze, co mozna bylo z nim zrobic, to nabic nasze liczniki i sprawic, ze proxy obrazkow
-- odpowiada 429 przez dobe. Mimo to unieważniamy go od razu: funkcja przestaje pytac o token,
-- wiec wykradziona wartosc nic juz nie znaczy.
--
-- ⚠️ Zostaje kompromis na czas przejsciowy: bez tokenu KAZDY moze podbic nasz licznik dobowy
-- i zgasic proxy obrazkow (to nadal nie kosztuje ani grosza i dotyka funkcji, ktorych apka
-- dzis nie uzywa - zdjec Google nie pokazujemy od 2026-09-15, mini-map od 2026-09-23).
-- ⛔ Docelowo funkcje brzegowe maja wolac `try_consume_rate_limit` KLUCZEM SERWISOWYM
-- (`SUPABASE_SERVICE_ROLE_KEY` w zmiennych Vercela) - kod juz to obsluguje i wtedy tej
-- funkcji nalezy odebrac EXECUTE dla anon.

DROP FUNCTION IF EXISTS public.try_consume_edge_quota(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.try_consume_edge_quota(
  p_bucket text,
  p_limit integer,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz;
  v_hits integer;
begin
  if p_bucket is null or length(p_bucket) > 120 then return false; end if;
  p_limit := least(greatest(coalesce(p_limit, 1), 1), 100000);
  p_window_minutes := least(greatest(coalesce(p_window_minutes, 60), 1), 1440);

  v_start := to_timestamp(
    floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );
  insert into public.fn_rate_limit (bucket, window_start, hits)
  values ('edge:' || p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = fn_rate_limit.hits + 1
  returning hits into v_hits;

  if random() < 0.001 then
    delete from public.fn_rate_limit where window_start < now() - interval '2 days';
  end if;

  return v_hits <= p_limit;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.try_consume_edge_quota(text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.try_consume_edge_quota(text, integer, integer) TO anon, authenticated, service_role;
