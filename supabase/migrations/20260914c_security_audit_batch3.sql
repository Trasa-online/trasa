-- Audyt bezpieczenstwa nr 3 (2026-09-14, przed premiera) - domkniecie znalezisk.
-- Kazdy blok ma numer z raportu; kolejnosc = od najgrozniejszych.

-- ─────────────────────────────────────────────────────────────────────────────
-- H1. routes: polityka "Routes visible to owner and followers" (04.2026, gdy kazda trasa byla
-- publiczna z automatu) dawala OBSERWUJACYM odczyt WSZYSTKICH tras autora - takze roboczych
-- i prywatnych (tytul, opis, daty, okladka, notki). Follow jest 1-klik bez akceptacji, wiec
-- kazdy mogl czytac cudze szkice przez PostgREST. Zweryfikowane: 8 cudzych roboczych wyjazdow
-- widocznych z konta Nat. Zostaje: wlasciciel + istniejace polityki (is_shared / grupa).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Routes visible to owner and followers" ON public.routes;
DROP POLICY IF EXISTS "Owner can read own routes" ON public.routes;
CREATE POLICY "Owner can read own routes"
  ON public.routes FOR SELECT
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- H2. propagate_place_note(p_user, ...) / find_place_note(p_user, ...) to pomocniki
-- wyzwalaczy (migracja 20260913f), ale Postgres daje EXECUTE dla PUBLIC z automatu - kazdy
-- z anon key mogl przez rpc/ WPISAC notke jako DOWOLNY user (do wszystkich jego kolekcji
-- i wyjazdow, publicznie widoczna) albo odczytac cudze prywatne notki. Wyzwalacze sa
-- SECURITY DEFINER (wlasciciel = postgres), wiec REVOKE ich nie dotyka.
-- H3. Funkcje cronowe / wewnetrzne (przypomnienia, harmonogram pushy, digest, czyszczenie
-- kwarantanny, liczniki kwoty Google) tez byly wykonywalne z anon key: kazdy mogl odpalic
-- przypomnienia (push do wszystkich userow), wyzerowac dzienny budzet Google (DoS wizytowek)
-- albo wywolac funkcje brzegowe z prawdziwym sekretem. pg_cron i edge (service_role)
-- dzialaja dalej. Do tego martwe funkcje po usunietym parowaniu grupowym (2026-08-06).
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.propagate_place_note(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_place_note(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_trip_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_trip_reminders(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_push_scheduler(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_daily_analytics_digest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_monitor_user_threshold() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_moderation_quarantine() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_consume_google_quota(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_consume_textsearch_month(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_memories(vector, double precision, integer, uuid) FROM PUBLIC, anon, authenticated;
-- martwe po usunieciu parowania grupowego (zero wywolan w kliencie i edge)
REVOKE EXECUTE ON FUNCTION public.get_group_session_by_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_round_pool(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_group_round(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_round_for_user(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vote_on_round(uuid, text) FROM PUBLIC, anon, authenticated;
-- sync zdjec z listy: wola go tylko wyzwalacz (SECDEF); z klienta idzie sync_route_place_photos
REVOKE EXECUTE ON FUNCTION public.sync_list_place_photos(uuid) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- M2. routes / discovery_collections: kolumny, ktorych wlasciciel nie ma prawa ruszac,
-- a polityka UPDATE (auth.uid() = user_id) pozwalala na wszystko: hidden_by_admin (odkrycie
-- wyjazdu schowanego przez moderacje), published_at (eksploracja sortuje po nim - "odswiez"
-- i jestes na szczycie), likes_count / saves_count / views(_count) (sztuczna popularnosc).
-- Straznik BEFORE UPDATE przywraca wartosci OLD dla zwyklych rol; SECURITY DEFINER
-- (current_user = postgres), service_role i admin przechodza. Nazwa z "00", zeby odpalal sie
-- PRZED trg_routes_stamp_published_at (kolejnosc alfabetyczna) - pieczatka publikacji zostaje.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_route_protected_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.hidden_by_admin := OLD.hidden_by_admin;
    NEW.published_at    := OLD.published_at;
    NEW.likes_count     := OLD.likes_count;
    NEW.saves_count     := OLD.saves_count;
    NEW.views           := OLD.views;
    NEW.user_id         := OLD.user_id;
    NEW.created_at      := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_routes_00_guard_protected ON public.routes;
CREATE TRIGGER trg_routes_00_guard_protected
  BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.guard_route_protected_columns();

CREATE OR REPLACE FUNCTION public.guard_collection_protected_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.likes_count     := OLD.likes_count;
    NEW.saves_count     := OLD.saves_count;
    NEW.views_count     := OLD.views_count;
    NEW.plan_adds_count := OLD.plan_adds_count;
    NEW.user_id         := OLD.user_id;
    NEW.created_at      := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_collections_00_guard_protected ON public.discovery_collections;
CREATE TRIGGER trg_collections_00_guard_protected
  BEFORE UPDATE ON public.discovery_collections FOR EACH ROW EXECUTE FUNCTION public.guard_collection_protected_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- M3. profiles: UPDATE/INSERT byly nadane na WSZYSTKIE kolumny, wiec user mogl sam sobie
-- wpisac referred_by (nagroda za zaproszenia = 3 konta i teczowa ramka), zmienic referral_code,
-- invite_code, znaczniki usuniecia konta. Klient zapisuje te pola wylacznie przez RPC
-- (attach_referral, delete_current_user_account, handle_new_user), wiec granty schodza.
-- M4. Kolumny, ktorych klient nigdy nie czyta, a byly publiczne: kto usunal konto i dlaczego,
-- zgoda na profilowanie. (home_city zostaje - zasila "lokals poleca!"; deleted_at zostaje -
-- panel ops filtruje po nim.)
-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE/INSERT byly grantem TABELOWYM (column-level REVOKE nic by nie dal) - zdejmujemy tabelowy
-- i nadajemy per kolumna, tak jak SELECT od 2026-08-21.
REVOKE UPDATE, INSERT, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  username, first_name, bio, avatar_url, avatar_frame, avatar_frame_color, dietary_prefs, travel_interests,
  home_country, home_city, language, onboarding_completed, terms_accepted_at,
  cookie_consent, cookie_consent_at, profiling_consent, profiling_consent_at
) ON public.profiles TO authenticated;
GRANT INSERT (
  id, username, first_name, bio, avatar_url, avatar_frame, avatar_frame_color, dietary_prefs, travel_interests,
  home_country, home_city, language, onboarding_completed, terms_accepted_at,
  cookie_consent, cookie_consent_at, profiling_consent, profiling_consent_at
) ON public.profiles TO authenticated;
REVOKE SELECT (deleted_by, deletion_reason, profiling_consent, profiling_consent_at)
  ON public.profiles FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- M1. business_profiles: polityka publicznego odczytu (is_active) obejmowala CALY wiersz,
-- wiec anon czytal email wlasciciela, preview_token (klucz do podgladu panelu bez logowania)
-- i promo_code. Widok business_profiles_public (security_invoker) juz wybiera bezpieczne
-- kolumny, wiec: SELECT tylko na nie (anon) + pola robocze panelu (authenticated - panel ops
-- moderacji czyta email/daty), preview_token i promo_code dla nikogo. Panel lokalu czyta swoj
-- pelny wiersz przez business_profile_for_dashboard() (wlasciciel / admin / poprawny token).
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE SELECT ON public.business_profiles FROM anon, authenticated;
GRANT SELECT (
  id, place_id, owner_user_id, business_name, logo_url, cover_image_url, cover_video_url,
  gallery_urls, menu_image_urls, website, booking_url, description, opening_hours, social_links,
  is_verified, is_premium, is_active, is_draft, promo_title, promo_description, promo_expires_at,
  phone, address, street, city, postal_code, tags, main_category, secondary_category,
  subcategories, color_badge, color_card_bg, color_button, color_promo, latitude, longitude,
  event_title, event_title_en, event_description, event_starts_at, event_ends_at, created_at
) ON public.business_profiles TO anon, authenticated;
GRANT SELECT (
  email, updated_at, plan, activated_at, review_requested_at, verification_notified_at,
  custom_subcategory, custom_subcategory_status, draft_created_at, moderation_status,
  moderated_at, event_title_en_overridden
) ON public.business_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.business_profile_for_dashboard(p_key uuid, p_token text DEFAULT NULL)
RETURNS SETOF public.business_profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.business_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.business_profiles
   WHERE place_id = p_key OR id = p_key
   ORDER BY (place_id = p_key) DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND (v_row.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN NEXT v_row; RETURN;
  END IF;
  -- Podglad bez logowania: tylko z poprawnym tokenem (link "Skopiuj podglad" dla admina).
  IF p_token IS NOT NULL AND length(p_token) >= 16 AND v_row.preview_token IS NOT NULL AND v_row.preview_token = p_token THEN
    RETURN NEXT v_row; RETURN;
  END IF;
  RETURN;
END $$;
REVOKE EXECUTE ON FUNCTION public.business_profile_for_dashboard(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_profile_for_dashboard(uuid, text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- M6. place_photos.photo_url: polityka INSERT sprawdzala tylko user_id, wiec przez PostgREST
-- dalo sie podpiac DOWOLNY adres obrazka (np. z obcej domeny, bez SafeSearch) pod kazde
-- miejsce - a place_photos zasila galerie "Od uzytkownikow" i talie na ekranie powitalnym
-- (przed logowaniem). Wszystkie 259 istniejacych wierszy wskazuja na nasz storage.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.place_photos DROP CONSTRAINT IF EXISTS place_photos_url_own_storage;
ALTER TABLE public.place_photos ADD CONSTRAINT place_photos_url_own_storage CHECK (
  photo_url LIKE 'https://api.spontaway.com/storage/v1/object/public/%'
  OR photo_url LIKE 'https://chxphfcpehxshvijqtlf.supabase.co/storage/v1/object/public/%'
);
