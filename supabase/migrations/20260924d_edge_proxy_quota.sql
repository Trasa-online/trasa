-- BEZPIECZNIK KOSZTOWY DLA PUBLICZNYCH PROXY OBRAZKOW (audyt naduzyc 2026-09-24).
--
-- `/api/place-photo` i `/api/static-map` to funkcje brzegowe Vercela, ktore wolaja PLATNE
-- API Google (Places Photo 7 $/1000 przy 1000 darmowych, Static Maps 2 $/1000 przy 10 000).
-- Sa PUBLICZNE i nie mialy zadnego limitu: kazdy, kto podejrzy adres w aplikacji, moze
-- w petli generowac rozne adresy (inne `w`, inne wspolrzedne), a kazdy rozny adres to
-- pudlo w CDN i nowe platne wywolanie. Przy 10 zadaniach na sekunde to ~860 tys. wywolan
-- na dobe, czyli rachunek rzedu tysiecy zlotych.
--
-- ⚠️ Funkcje brzegowe Vercela maja tylko klucz ANON (patrz api/share.ts), wiec nie moga
-- wolac `try_consume_rate_limit`, ktory jest wylacznie dla service_role. Dlatego osobne
-- wejscie z TOKENEM: token zyje w kodzie SERWEROWYM Vercela (katalog api/, nigdy w paczce
-- przegladarki), wiec z zewnatrz nie da sie nabic licznika i zablokowac nam obrazkow.
--
-- ⛔ To NIE jest uwierzytelnienie uzytkownika - to licznik. Token chroni wylacznie przed
-- podbijaniem cudzego limitu; sam dostep do obrazka jest z zalozenia publiczny.

CREATE OR REPLACE FUNCTION public.try_consume_edge_quota(
  p_token text,
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
  -- Zly token = brak zgody. Fail-closed, bo jedynym powodem, dla ktorego ktos wola te
  -- funkcje bez tokenu, jest probowanie.
  if p_token is distinct from 'P24k23k7po8533LbqL_Z8T2TUEHwjv60' then
    return false;
  end if;
  if p_bucket is null or length(p_bucket) > 120 then return false; end if;
  -- Limity sa po NASZEJ stronie, ale i tak przycinamy: nikt nie ustawi sobie miliona.
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

REVOKE EXECUTE ON FUNCTION public.try_consume_edge_quota(text, text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.try_consume_edge_quota(text, text, integer, integer) TO anon, authenticated, service_role;
