

## Cache Find Place + Place Details w Supabase

### Koszt obecny vs po cache'owaniu

| Wywołanie | Obecny koszt (każde otwarcie) | Po cache (pierwsze) | Po cache (kolejne) |
|-----------|------|------|------|
| Find Place | $0.017 | $0.017 | **$0.00** |
| Place Details | $0.017 | $0.017 | **$0.00** |
| Photos (3 szt.) | $0.021 (już cache) | $0.021 | $0.00 |
| **Razem** | **$0.055** | **$0.055** | **$0.00** |

Po implementacji: **każde kolejne otwarcie tego samego miejsca = $0.00.** Przy 100 unikalnych miejscach oglądanych średnio 10 razy, oszczędność ~$50 → ~$5.50.

### Plan implementacji

**1. Migracja SQL — tabela `place_details_cache`**
```sql
CREATE TABLE public.place_details_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,  -- hash z placeName+lat+lng
  place_id text,
  response jsonb NOT NULL,         -- pełny wynik Place Details
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days'
);
```
- Cache key = deterministyczny hash z `placeName + lat + lng` (zaokrąglone do 4 miejsc)
- TTL 7 dni — po tym czasie dane odświeżane z Google (opinie, godziny otwarcia mogą się zmienić)
- RLS: publiczny read, insert/delete tylko service_role

**2. Edge Function `google-places-proxy` — cache layer**
- Przed wywołaniem Google API: sprawdź `place_details_cache` po `cache_key`
- Jeśli jest i nie wygasł → zwróć `response` z cache (0 wywołań Google)
- Jeśli brak/wygasł → wykonaj Find Place + Place Details jak teraz, zapisz wynik w cache, zwróć
- Dotyczy głównego flow (linie 162-236), nie akcji `cache-photo`/`citysearch`/`textsearch`

**3. Bez zmian na frontendzie**
- Komponenty wywołują tę samą funkcję tak samo — cache jest transparentny po stronie edge function

### Pliki do edycji
1. Nowa migracja SQL (tabela + RLS)
2. `supabase/functions/google-places-proxy/index.ts` — dodanie warstwy cache

