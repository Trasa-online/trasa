-- AUDYT BEZPIECZENSTWA 2026-09-24 - poprawki znalezione przy przegladzie RLS.
--
-- 1. TLUMACZENIA BYLY CZYTELNE DLA KAZDEGO ZALOGOWANEGO.
--    Tabela `translations` to cache wynikow (tekst zrodlowy + tlumaczenie) dla funkcji
--    `translate-text`. Polityka `translations_read` wpuszczala KAZDEGO zalogowanego, a w tabeli
--    laduje tresc uzytkownikow - takze notka z PRYWATNEGO planu, jesli jej autor poprosil
--    o tlumaczenie. Kto znal albo zgadl `source_hash`, dostawal cudzy tekst; zwykly `select *`
--    oddawal wszystko naraz.
--    ⚠️ Nikt tego nie czytal z klienta: `src/lib/translate.ts` wola funkcje brzegowa, a ta ma
--    klucz service_role (patrz translate-text/index.ts). Po zdjeciu polityki tabela zostaje bez
--    zadnej - czyli czyta ja wylacznie service_role.
DROP POLICY IF EXISTS translations_read ON public.translations;

-- 2. ZAPIS NA WAITLISTE BYL BEZ ZADNEGO SUFITU.
--    Polityka INSERT `true` (tak ma byc - to formularz na landingu, przed logowaniem), ale
--    bez limitu jeden skrypt wstawia setki tysiecy wierszy. Limit jest GLOBALNY i godzinowy,
--    bo w bazie nie ma adresu IP; 300/h przy dzisiejszym ruchu (7 zapisow LACZNIE) jest
--    nieosiagalne dla czlowieka, a mechanicznemu zalewowi ucina glowe.
--    ⚠️ Swiadomy koszt: przy ataku legalne zapisy z tej godziny tez padna. Przy wyborze
--    „spam w bazie i w skrzynce" kontra „godzina bez zapisow" wybieramy to drugie.
CREATE OR REPLACE FUNCTION public.rl_waitlist() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / 3600) * 3600);
  v_hits integer;
begin
  insert into public.fn_rate_limit (bucket, window_start, hits)
  values ('waitlist:all', v_start, 1)
  on conflict (bucket, window_start) do update set hits = fn_rate_limit.hits + 1
  returning hits into v_hits;
  if v_hits > 300 then
    raise exception 'rate_limited' using hint = 'waitlist', errcode = 'check_violation';
  end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS trg_rl_waitlist ON public.waitlist;
CREATE TRIGGER trg_rl_waitlist BEFORE INSERT ON public.waitlist
FOR EACH ROW EXECUTE FUNCTION public.rl_waitlist();
