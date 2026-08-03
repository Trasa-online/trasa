# Raport bezpieczeństwa - Trasa (web fake door + apka natywna + backend)
**Data:** 2026-08-04 (audyt nocny z 2026-08-03)
**Zakres:** cała powierzchnia - fake door (trasatravel.com), apka natywna, Supabase (RLS, 34 edge functions, Storage, auth/RBAC), Vercel/API.
**Metoda:** 6 równoległych agentów-audytorów po wymiarach + adwersarialna weryfikacja każdego znaleziska high/critical (drugi agent próbował je obalić). Rekonesans na żywej bazie (project chxphfcpehxshvijqtlf).

> ⚠️ **Uwaga metodyczna:** weryfikatorzy - w ramach Twojej zgody na audyt - wykonali realne PoC na produkcji: odczyt danych publicznym anon key oraz **jeden** INSERT+DELETE kanarka w `route_examples`. Kanarek posprzątany (residue = 0, tabela ma znów 128 wierszy, nic nie uszkodzone). W tym raporcie **zredagowałem wszystkie realne dane** (maile/telefony/tokeny) - nie ma tu żadnego PII.

---

## TL;DR

**Ocena ogólna: fundamenty OK, ale jest kilka realnych dziur w RLS i edge functions do naprawy PRZED puszczeniem ruchu z adsów.** Haker nie wejdzie do "środka serwera" (sekrety bezpieczne, model ról szczelny), ale przez **publiczny anon key + otwarte polityki RLS + publiczne funkcje** może: wyciągnąć PII właścicieli lokali, przejąć wizytówki miejsc i wstrzyknąć treść do feedu, wysyłać phishing-push i maile z Waszej domeny, oraz kasować/zatruwać dane treningowe AI. Wszystko **bez logowania lub z kontem gościa**.

| Poziom | Liczba (po deduplikacji) | Naprawić |
|---|---|---|
| 🔴 WYSOKIE | 7 | **przed adsami** |
| 🟠 ŚREDNIE | ~9 | w tym tygodniu |
| 🟡 NISKIE | 9 | backlog |
| 🟢 INFO/pozytywy | 6 | - |

**Najgroźniejsze 3:** (1) przejęcie/impersonacja wizytówki dowolnego lokalu z wstrzyknięciem treści do feedu eksploracji, (2) publiczny wyciek email/telefon właścicieli lokali + sekretnych `preview_token`, (3) `send-push` - dowolny gość wysyła phishing-push do dowolnego usera.

---

## 🟢 Co jest dobrze (potwierdzone)

- **Wszystkie 66 tabel `public` mają RLS włączone.** Brak tabeli "na golasa".
- **Zero wycieku sekretów.** `service_role` key nie występuje w bundlu weba, w `src/`, ani w historii gita. `.env` w historii zawierał tylko klucze publiczne (anon key, URL, VITE_ maps/vapid). Skrypty czytają service_role z `process.env`. **Rotacja kluczy niepotrzebna.**
- **Model ról admina egzekwowany po stronie serwera** - zwykły user nie podniesie sobie uprawnień przez `user_roles` (polityki szczelne).
- **0 `dangerouslySetInnerHTML`** - niska powierzchnia XSS.
- `.env` jest w `.gitignore` i nietrackowany w HEAD.

---

## 🔴 WYSOKIE - naprawić przed adsami

### H1. Przejęcie i impersonacja wizytówki dowolnego miejsca (+ wstrzyknięcie treści do feedu)
**Gdzie:** polityki INSERT na `business_profiles` (`CHECK = owner_user_id = auth.uid()`), konsumpcja bez filtra: `PlaceSwiper.tsx:1014`, `PlaceDetailSheet.tsx:76`.
**Problem:** polityka INSERT sprawdza tylko `owner_user_id = auth.uid()`. Kolumny `place_id`, `is_verified`, `is_active`, `moderation_status` **nie są ograniczone**. Dowolny zalogowany user (także **gość anonymous-auth**) robi jeden `POST /rest/v1/business_profiles` z `{owner_user_id: <swoje>, place_id: <cudze miejsce>, is_verified:true, moderation_status:'approved', ...}` i staje się właścicielem wizytówki niezajętego lokalu (większość katalogu). Zapytania wyświetlające czytają wizytówkę po `place_id` **bez filtra `moderation_status`/`owner`**, więc treść atakującego (zdjęcia, opis, link www, fałszywy badge "zweryfikowano") jest natychmiast pokazywana wszystkim jako oficjalna. Omija cały flow `business_claims → admin-moderate-business`.
**Fix:** (1) tworzenie wizytówek tylko przez edge function z service_role, albo trigger `BEFORE INSERT/UPDATE` wymuszający `moderation_status='pending', is_verified=false, is_active=false` i zakaz ustawiania `place_id` z klienta; (2) **krytyczne niezależnie od RLS:** wszystkie zapytania join `business_profiles` MUSZĄ filtrować `moderation_status='approved' AND is_active AND owner_user_id IS NOT NULL`.

### H2. Publiczny odczyt `business_profiles` wystawia PII + sekretny `preview_token`
**Gdzie:** dwie (zduplikowane) polityki SELECT `Anyone can read business_profiles` (`{anon,authenticated}`, `USING=true`).
**Problem:** RLS jest wierszowy, nie kolumnowy - anon czyta **cały wiersz**, w tym `email`, `phone`, `owner_user_id`, `preview_token`, `promo_code`, `moderation_note`, `is_draft`. Potwierdzone realnym GET-em anon key (zwrócił prawdziwe maile/telefony/tokeny - zredagowane). `preview_token` to sekret bearer (dostęp do podglądu draftu bez logowania - `BusinessDashboard.tsx:673`), więc jego publiczna czytelność znosi tę ochronę.
**Fix:** odetnij anon od surowej tabeli, wystaw publiczny **VIEW** tylko z kolumnami bezpiecznymi (patrz gotowy SQL na końcu). `preview_token` obsłuż edge functionem z service_role (walidacja `token==param` server-side).

### H3. `profiles` - publiczny odczyt `invite_code` + danych usuniętych kont
**Gdzie:** polityka SELECT `Public profiles are viewable by everyone` (`public`, `USING=true`).
**Problem:** anon czyta cały wiersz `profiles`: `invite_code` (u wszystkich userów), `deleted_by`, `deletion_reason`, `first_name`, `home_city`, preferencje, zgody. `invite_code` jest wrażliwy funkcjonalnie - `AddFriend.tsx` (`/dodaj/:code`) tworzy **auto-znajomość bez akceptacji**, więc zdump kodów = masowe wymuszanie relacji follow/friend (spam grafu społecznego, wektor phishingu wewnątrz apki). Dane osób, które usunęły konto, wciąż odpytywalne.
**Fix:** publiczny VIEW bez `invite_code`/danych usunięcia; `invite_code` czytany tylko przez właściciela, a `/dodaj/:code` rozwiązywany przez RPC/edge z service_role.

### H4. `send-push` - IDOR: dowolny gość wysyła dowolny push do dowolnego usera
**Gdzie:** `supabase/functions/send-push/index.ts` (`verify_jwt=false`, target `user_id`/`title`/`body`/`url` z body).
**Problem:** funkcja autoryzuje **każdego** zalogowanego (w tym konto **anonymous-auth**) LUB service_role, po czym wysyła push do `user_id` **prosto z body**, bez sprawdzenia relacji nadawca-odbiorca. `title`, `body`, `url` (deep-link) w pełni kontrolowane przez atakującego. `user_id` da się enumerować z publicznego `profiles`.
**Impact:** phishing-push do całej bazy ("Zresetuj hasło" + deep link do złośliwego ekranu), spam, harassment - z wiarygodnością powiadomienia od Trasy.
**Fix:** dla wywołań userowych `target = auth.uid()` (ignoruj `user_id` z body); dowolny target tylko dla service_role (push-scheduler) albo po walidacji relacji (follow/grupa) server-side. Rozważ whitelistę prefiksów `url`.

### H5. `register-business` - publiczne masowe zakładanie kont + email bombing
**Gdzie:** `supabase/functions/register-business/index.ts` (`verify_jwt=false`).
**Problem:** na podstawie samego body (email+nazwa) service-role tworzy auth usera, `profiles`, `business_profiles` i wysyła branded mail aktywacyjny na **dowolny adres**; dla istniejących kont wysyła recovery/magiclink. Jedyna ochrona to in-memory rate-limit 5/min/IP (per-instancja, kasowany przy cold-start - trywialnie omijalny).
**Impact:** zaśmiecanie `auth.users`/`profiles` tysiącami wpisów (koszt, fałszywe metryki, może odpalić `monitor-user-threshold`), email bombing ofiar z zaufanej domeny, pre-squatting kont realnych firm.
**Fix:** captcha/turnstile + **trwały** rate-limit (tabela/Redis, per IP i per email), nie wysyłaj cicho recovery do istniejących kont, idempotencja per email.

### H6. `fakedoor-lead-email` - otwarty relay mailowy z zaufanej domeny
**Gdzie:** `supabase/functions/fakedoor-lead-email/index.ts` (`verify_jwt=false`). *(nasza własna funkcja z dzisiaj)*
**Problem:** całkowicie publiczna; `to` i treść (`route`) z body. HTML jest escapowany (brak HTML-injection), ale atakujący steruje dowolnym tekstem i **dowolnym adresatem**. Mail wychodzi z `hello@trasa.travel` (SPF/DKIM OK). Rate-limit jak wyżej - omijalny.
**Impact:** email bombing/phishing z Waszej domeny → spalenie reputacji (blacklisty, problemy z dostarczalnością realnych maili), koszty Resend.
**Fix:** renderuj mail **z rekordu `fakedoor_leads` po stronie serwera** (bierz email/route z bazy po insercie leada, nie z requestu) + trwały rate-limit + captcha. Krótkoterminowo: przynajmniej deduplikacja per lead i twardy limit.

### H7. `route_examples` - anon ma pełny CRUD (błąd w polityce RLS)
**Gdzie:** polityka `Service role full access` na `route_examples` - utworzona **bez `TO service_role`**, więc obowiązuje rolę PUBLIC (`USING=true, CHECK=true, cmd=ALL`). Migracja `20260328_route_examples.sql` (komentarz mówi "Only service role can write" - intencja ≠ implementacja).
**Problem (potwierdzone realnym PoC):** anon key może INSERT/UPDATE/**DELETE** wszystkich 128 wierszy. Te przykłady zasilają generator tras AI (`plan-route/index.ts:691` wstrzykuje je jako few-shot do promptu dla **wszystkich** userów).
**Impact:** (1) skasowanie danych seed AI; (2) **stored prompt-injection** - wpis `is_approved=true` z treścią atakującego trafia do promptu każdego usera; (3) DoS przez masowy INSERT.
**Fix:** `DROP POLICY` i odtwórz z `TO service_role` (service_role i tak omija RLS). Uwaga: jeśli klient wstawia kandydatów (`RouteSummaryDialog.tsx:240`), zostaw wąską politykę INSERT `WITH CHECK (auth.uid() IS NOT NULL AND is_approved = false)`.

---

## 🟠 ŚREDNIE (skrót - pełne fixy w findings)

- **`canonical_pins`** - dowolny zalogowany user może UPDATE **każdego** globalnego pinu (zdegenerowane `OR` w polityce) → wandalizm danych eksploracji. Fix: zawęź USING do właściciela.
- **`demo_sessions`/`demo_reactions`** - anon pełny CRUD → spam/DoS + kasowanie cudzych. Fix: zostaw tylko INSERT+SELECT dla anon.
- **In-memory rate-limit we wszystkich publicznych funkcjach mailowych** - nieskuteczny (per-instancja, cold-start reset). Fix: trwały limit (DB/Redis) + captcha.
- **`send-*` (welcome/reset/waitlist)** - efektywnie publiczna wysyłka maili na dowolny adres (anon-key traktowany jako "autoryzacja"). Fix: wysyłka welcome triggerem po realnym signup, nie z body; captcha+limit na resecie.
- **Brak nagłówków bezpieczeństwa** (CSP, X-Frame-Options, HSTS, Referrer-Policy) na Vercelu → **clickjacking na formularze auth B2B/set-password**. Fix: blok `headers` w `vercel.json` (min. `X-Frame-Options: DENY` + CSP).
- **`api/static-map.ts`** - otwarte proxy Google Static Maps bez allowlisty params → cost abuse (pompowanie rachunku Google). Fix: walidacja size/scale/maptype + sprawdzanie Origin + dzienny budżet w GCP.
- **Admin "Koszty Google Places API"** - RPC `textsearch_month_usage()`/`google_quota_usage()` czytelne dla **anon** (bramka admina tylko w UI) → wyciek metryk kosztowych/BI. Fix: `has_role(auth.uid(),'admin')` na wejściu RPC + `REVOKE EXECUTE FROM anon, authenticated`.
- **Storage** - buckety `route-images`/`placeholders` przyjmują dowolne pliki od dowolnego zalogowanego (w tym gościa), bez limitu MIME/rozmiaru/ownershipu → hosting `svg+xml`/`html` (stored XSS przy otwarciu) i phishingu pod `trasa.travel`. Fix: `allowed_mime_types` (image/*) + `file_size_limit` + ownership ścieżki (`foldername[1] = auth.uid()`).
- **`NativeDeepLinkHandler` (App.tsx:263)** - przyjmuje `access_token`/`refresh_token` z deep linku → **session fixation** (ofiara logowana w konto atakującego). Fix: tylko PKCE `code` + walidacja dokładnego host/scheme, nie `substring`.
- **Stored XSS przez telefon wizytówki** (`BusinessActionButtons.tsx:30`, `window.location.href = tel:${phone}`) - właściciel lokalu ustawia `javascript:` payload. Fix: walidacja schematu przy zapisie i renderze (tylko http/https / cyfry).

---

## 🟡 NISKIE (backlog)

- **`VITE_GOOGLE_MAPS_API_KEY` w bundlu** (nieuniknione dla web-maps) → **ogranicz klucz do domen trasa.travel w GCP** + budżet/alerty. *(dotyczy też jutrzejszego "podglądu Google Maps na landingu")*
- **CORS `*` na wielu funkcjach** (w tym `admin-*`) - dopuszczalne przy JWT, ale zawęź dla funkcji z danymi.
- **`WebWaitlistGate` to bariera tylko kliencka** - bypass parametrem URL; realną barierą jest RLS (dlatego RLS musi być szczelne - patrz wyżej).
- **`business_claims`** - otwarty INSERT dla anon (spam leadów z dowolnym `contact_email`). Fix: rate-limit/captcha.
- **`cache-place-photo`** - anon może nadpisać `photo_url` dowolnego pinu (cache poisoning). Fix: ownership/service_role.
- **`scraped_places`/`place_details_cache`/`place_photo_cache`** - publiczny odczyt (ekspozycja danych scrapowanych). Ocenić czy zamierzone.
- **`send-push`** loguje metadane klucza APNs (.p8) do logów. Fix: usuń log.
- **`upgrade-business-account`** - `email_confirm=true` pozwala ustawić niezweryfikowany email na własnym koncie.
- **Drobne:** nieużywany hardcoded password (MaintenanceGate) i niewalidowany `next` w auth callbacku (open-redirect - domknąć allowlistą).

---

## Plan naprawy (kolejność)

**Przed adsami (dziś rano):**
1. **RLS - 1 migracja SQL** (H2, H3, H7 + canonical_pins, demo, admin-RPC) - gotowy szkielet niżej. ⚠️ H2/H3 wymagają **równoczesnego przepięcia klienta** na nowe VIEW (`business_profiles_public`, `profiles_public`), inaczej apka przestanie czytać wizytówki/profile. Dlatego robimy SQL + zmiany w `src/` w jednym kroku.
2. **H1 (impersonacja)** - trigger sanityzujący + filtry `moderation_status='approved'` w zapytaniach wyświetlających.
3. **Edge functions authz:** `send-push` (target=auth.uid), `register-business`/`fakedoor-lead-email` (render z bazy + trwały limit + captcha).
4. **Nagłówki bezpieczeństwa** (`vercel.json`) + **Storage MIME/rozmiar**.

**W tym tygodniu:** reszta średnich (deep-link PKCE, static-map allowlist, XSS walidacja telefonu/www).

---

## Gotowa migracja SQL (do PRZEGLĄDU - nie zaaplikowana)

> Nie aplikowałem nic - część zmian (VIEW-y) wymaga skoordynowanego przepięcia klienta, żeby nie zepsuć apki. Poniżej szkielet do wspólnego przejrzenia rano.

```sql
-- H7: route_examples - tylko service_role pisze
DROP POLICY IF EXISTS "Service role full access" ON public.route_examples;
CREATE POLICY "service_role writes route_examples" ON public.route_examples
  FOR ALL TO service_role USING (true) WITH CHECK (true);
-- (opcjonalnie kandydaci z klienta:)
-- CREATE POLICY "user proposes route_example" ON public.route_examples
--   FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND is_approved = false);

-- H2: business_profiles - publiczny widok bez PII (potem przepiąć klienta na _public)
DROP POLICY IF EXISTS "Anyone can read business profiles"  ON public.business_profiles;
DROP POLICY IF EXISTS "Anyone can read business_profiles"  ON public.business_profiles;
CREATE VIEW public.business_profiles_public WITH (security_invoker = true) AS
  SELECT id, place_id, business_name, logo_url, cover_image_url, cover_video_url,
         website, booking_url, description, opening_hours, social_links,
         is_verified, is_premium, is_active, promo_title, promo_description, promo_expires_at,
         gallery_urls, menu_image_urls, address, street, city, postal_code, tags,
         main_category, secondary_category, subcategories,
         color_badge, color_card_bg, color_button, color_promo, latitude, longitude,
         event_title, event_title_en, event_description, event_starts_at, event_ends_at
  FROM public.business_profiles
  WHERE is_active = true AND is_draft = false;
GRANT SELECT ON public.business_profiles_public TO anon, authenticated;

-- H3: profiles - publiczny widok bez invite_code/danych usunięcia
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "read own profile"  ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE VIEW public.profiles_public WITH (security_invoker = true) AS
  SELECT id, username, first_name, bio, avatar_url, home_country, home_city, travel_interests, created_at
  FROM public.profiles WHERE deleted_at IS NULL;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- ŚREDNIE: demo tables - odetnij UPDATE/DELETE anon; canonical_pins - tylko właściciel UPDATE;
--          admin RPC - dodać has_role + REVOKE EXECUTE FROM anon (osobno).
```

---

*Pełne surowe znaleziska (JSON) + zrzut 185 polityk RLS: w katalogu scratchpad audytu. Raport lokalny, nie commitowany (zawiera szczegóły podatności).*
