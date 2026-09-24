-- „NOWE OD TWOJEJ OSTATNIEJ WIZYTY" POKAZYWALO CALA KOLEKCJE (zgloszenie Nat 2026-09-24).
--
-- Objaw: wchodzisz do kolekcji, do ktorej ktos Cie zaprosil, i KAZDE miejsce ma plakietke
-- „nowe miejsce", a nad lista stoi „Nowe od Twojej ostatniej wizyty - 19". Ta sama kolekcja
-- dostaje tez gwiazdke „nowe miejsce" na kafelku.
--
-- Przyczyna: `respond_to_collection_invite` przy akceptacji wstawialo wiersz do
-- `saved_collections` BEZ `seen_item_count`, czyli z domyslnym ZEREM. Znacznik „nowe" liczy sie
-- jako `liczba miejsc - seen_item_count`, wiec zaraz po dolaczeniu wychodzilo „wszystko nowe".
-- Sciezka klienta (`saveCollectionDb`) ustawiala licznik od poczatku - luka byla tylko tutaj.
--
-- ⚠️ Punktem odniesienia jest CHWILA DOLACZENIA: „nowe" ma znaczyc „pojawilo sie, odkad tu
-- jestem", a nie „nigdy tego nie widzialem". Inaczej znacznik przestaje cokolwiek znaczyc
-- przy pierwszym wejsciu do kazdej wiekszej kolekcji.

CREATE OR REPLACE FUNCTION public.respond_to_collection_invite(p_collection_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_items int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_accept then
    update public.discovery_collection_members
       set status = 'accepted'
     where collection_id = p_collection_id and user_id = auth.uid() and status = 'pending';
    if not found then return jsonb_build_object('ok', false, 'reason', 'no_invite'); end if;
    select count(*) into v_items from public.discovery_items where collection_id = p_collection_id;
    -- Kolekcja ma sie POJAWIC u wspoltworcy bez szukania - do jego „Zapisane".
    -- `seen_item_count` = stan z chwili dolaczenia, wiec „nowe" zaczyna sie liczyc od teraz.
    insert into public.saved_collections (user_id, collection_id, seen_item_count)
    values (auth.uid(), p_collection_id, coalesce(v_items, 0))
    on conflict do nothing;
  else
    delete from public.discovery_collection_members
     where collection_id = p_collection_id and user_id = auth.uid() and status = 'pending';
  end if;
  return jsonb_build_object('ok', true);
end; $function$;

-- Naprawa istniejacych wierszy: zero przy kolekcji, ktora ma miejsca, to zawsze ten blad
-- (zapis z klienta nigdy nie ustawia zera dla niepustej kolekcji). Ustawiamy na stan BIEZACY -
-- to jedyna uczciwa wartosc, jaka mozemy dzis odtworzyc.
UPDATE public.saved_collections sc
   SET seen_item_count = i.n
  FROM (SELECT collection_id, count(*)::int AS n FROM public.discovery_items GROUP BY collection_id) i
 WHERE i.collection_id = sc.collection_id
   AND coalesce(sc.seen_item_count, 0) = 0
   AND i.n > 0;
