-- Przepisanie adresow trasa.travel -> spontaway.com w danych, ktore JUZ siedza w bazie.
--
-- Po co: kod robi `supabase.storage.getPublicUrl()` i zapisuje do bazy PELNY adres
-- (awatary, zdjecia lokali, zdjecia z tras, cache zdjec miejsc). Kazdy taki wiersz ma
-- w srodku "https://api.trasa.travel/storage/...". Samo przepiecie custom domain w
-- Supabase tych stringow nie ruszy - po wygasnieciu starej domeny zdjecia znikna.
--
-- ⚠️ URUCHOM DOPIERO PO aktywacji api.spontaway.com w Supabase. Wczesniej przepisze
--    adresy na host, ktory jeszcze nie odpowiada.
--
-- Skan jest schema-agnostyczny: leci po WSZYSTKICH kolumnach tekstowych, tablicowych
-- i json/jsonb w schemacie public, wiec zlapie tez kolumny, o ktorych nie pamietamy.
-- Widoki i kolumny generowane sa pomijane. Operacja jest idempotentna - drugie
-- uruchomienie nic nie zmieni.
--
-- Dry-run (pokazuje ile wierszy by ruszylo, nic nie zapisuje):
--   BEGIN; <ten DO block>; ROLLBACK;

DO $$
DECLARE
  r          record;
  pair       text[];
  n          bigint;
  total      bigint := 0;
  -- Kolejnosc bez znaczenia: "https://trasa.travel" nie jest podciagiem
  -- "https://api.trasa.travel", wiec pary sie nie zjadaja.
  pairs      text[][] := ARRAY[
                 ARRAY['https://api.trasa.travel', 'https://api.spontaway.com'],
                 ARRAY['https://trasa.travel',     'https://spontaway.com']
               ];
BEGIN
  FOR r IN
    SELECT c.table_name AS tbl, c.column_name AS col, c.udt_name AS udt
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.is_generated = 'NEVER'
      AND c.udt_name IN ('text', 'varchar', '_text', '_varchar', 'json', 'jsonb')
    ORDER BY c.table_name, c.column_name
  LOOP
    FOREACH pair SLICE 1 IN ARRAY pairs LOOP
      IF r.udt IN ('text', 'varchar') THEN
        EXECUTE format(
          'UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
          r.tbl, r.col, r.col, pair[1], pair[2], r.col, '%' || pair[1] || '%');

      ELSIF r.udt IN ('_text', '_varchar') THEN
        -- WITH ORDINALITY, zeby kolejnosc elementow tablicy sie nie rozjechala
        EXECUTE format(
          'UPDATE public.%I SET %I = (SELECT array_agg(replace(x, %L, %L) ORDER BY ord)
                                        FROM unnest(%I) WITH ORDINALITY AS u(x, ord))
             WHERE array_to_string(%I, '','') LIKE %L',
          r.tbl, r.col, pair[1], pair[2], r.col, r.col, '%' || pair[1] || '%');

      ELSE -- json / jsonb: podmiana na tekscie i rzut z powrotem
        EXECUTE format(
          'UPDATE public.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
          r.tbl, r.col, r.col, pair[1], pair[2], r.udt, r.col, '%' || pair[1] || '%');
      END IF;

      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        RAISE NOTICE '% . %  (%)  ->  % wierszy', r.tbl, r.col, pair[1], n;
        total := total + n;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'RAZEM przepisanych wierszy: %', total;
END $$;
