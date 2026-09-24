-- BANER "DZIEKUJEMY ZA WSPARCIE" dla nakladki przyznanej RECZNIE (prosba Nat 2026-09-24).
--
-- Kontekst: zaproszenia do testow ida od 24.09 prosto na TestFlight, a ten adres nie przyjmuje
-- parametrow - wiec licznik "N z 3" nie policzy juz nikogo, kogo tester realnie przyprowadzil.
-- Do premiery nagrode przyznajemy wiec RECZNIE, wpisem w `frame_grants`, i chcemy o tym
-- obdarowanego ZAWIADOMIC - inaczej nakladka po prostu pojawia sie w arkuszu i nikt jej nie
-- zauwazy.
--
-- ⛔ NIE uzywamy do tego `my_frame_gift`: ta funkcja celowo obsluguje wylacznie PREZENTY
-- (`moonstars`, `banana`) i odpala pelnoekranowy arkusz. `rainbow` jest NAGRODA - ma wlasny,
-- spokojniejszy komunikat (baner na profilu), a wpisanie go tam wyrzucaloby arkusz takze
-- zalozycielce, ktora ma grant od 2026-09-11.
--
-- "Widziane" trzyma ta sama kolumna co przy prezentach (`gift_seen_at`) i gasi je to samo
-- RPC `mark_frame_gift_seen` - jedna kolumna, jedno znaczenie: "user juz o tym wie".
--
-- ⚠️ Kolumna jest TEZ przelacznikiem publikacji: grant z wypelnionym `gift_seen_at` daje
-- nakladke BEZ banera (tak wchodzi nowa osoba, zanim baner zostanie zaakceptowany), a
-- wyzerowanie jej pokazuje baner przy najblizszym wejsciu na profil. Zadnego deployu.

CREATE OR REPLACE FUNCTION public.my_reward_grant()
RETURNS TABLE (frame text, seen boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.frame, g.gift_seen_at IS NOT NULL
    FROM public.frame_grants g
   WHERE g.user_id = auth.uid()
     -- Prezenty maja swoj wlasny ekran (`my_frame_gift` + FrameGiftSheet).
     AND g.frame NOT IN ('moonstars', 'banana')
   ORDER BY g.granted_at
   LIMIT 1;
$$;

-- Regula z audytu: SECDEF dostaje EXECUTE dla PUBLIC z automatu, wiec odbieramy i nadajemy jawnie.
REVOKE EXECUTE ON FUNCTION public.my_reward_grant() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_reward_grant() TO authenticated;
