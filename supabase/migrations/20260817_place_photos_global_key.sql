-- place_key staje sie GLOBALNY (name-only, bez miasta) - miejsce akumuluje zdjecia userow
-- niezaleznie od kontekstu (lista globalna, trasa w innym miescie). Re-key istniejacych wierszy:
-- 'nc:{nazwa}|{miasto}' -> 'nm:{nazwa}'. Klucze 'gpid:...' bez zmian.
UPDATE public.place_photos
SET place_key = 'nm:' || split_part(substring(place_key from 4), '|', 1)
WHERE place_key LIKE 'nc:%';
