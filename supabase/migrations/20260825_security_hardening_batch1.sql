-- Audyt bezpieczenstwa 2026-08-21, batch 1 (bezpieczne fixy DB, zero wplywu na legalne flow).
-- Zweryfikowane: klient nigdy nie wstawia tras/pinow z nie-swoim user_id; okladki/zdjecia ida do
-- sciezek {uid}/...; invite_code czytany przez get_my_profile (SECDEF); placeholders bez uploadu z klienta.

-- ============ H1: podszywanie sie / falszywe trasy ============
-- Luzna galaz "organizator moze zapisac trase/pin dla czlonka" pozwalala wstawic wiersz z DOWOLNYM
-- user_id (przypisanie tresci ofierze). Legalne kopie tras czlonkow ida przez SECDEF
-- copy_group_session_routes (omija RLS, kopiuje routes+pins), wiec te polityki sa zbedne. Usuwamy.
DROP POLICY IF EXISTS "Group organizer can save routes for members" ON public.routes;
DROP POLICY IF EXISTS "Group organizer can save pins for member routes" ON public.pins;
-- Zostaja: "Users can create their own routes" (user_id=auth.uid()) i "Users can create pins for their routes".

-- ============ H6: limity bucketow (blok uploadu wielkich plikow + dowolnej tresci HTML/SVG/JS) ============
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'avatars';
update storage.buckets set file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'place-photos';
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'placeholders';
update storage.buckets set file_size_limit = 26214400,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'] where id = 'route-images';
update storage.buckets set file_size_limit = 26214400,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'] where id = 'trip-photos';

-- ============ M1: INSERT do route-images/placeholders ograniczony do folderu usera ============
-- route-images: upload tylko do {uid}/... (zgodne ze sciezka {userId}/collections|{routeId}/...).
DROP POLICY IF EXISTS "Authenticated users can upload route images" ON storage.objects;
CREATE POLICY "Users can upload own route images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'route-images' AND (storage.foldername(name))[1] = auth.uid()::text);
-- placeholders: brak uploadu z klienta -> tylko admin (seed).
DROP POLICY IF EXISTS "Authenticated users can upload placeholders" ON storage.objects;
CREATE POLICY "Admins can upload placeholders" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'placeholders' AND has_role(auth.uid(), 'admin'::app_role));

-- ============ M2: invite_code nie moze byc publicznie czytelny (unconsented befriend_via_invite) ============
-- Owner czyta swoj invite_code przez get_my_profile (SECURITY DEFINER, omija grant kolumny).
-- befriend_via_invite (SECDEF) czyta go server-side. Zaden klient nie robi select(invite_code)/select(*).
-- REVOKE na poziomie KOLUMNY nie dziala gdy istnieje grant na poziomie TABELI - trzeba zdjac grant
-- tabelowy i nadac z powrotem SELECT na wszystkie kolumny OPROCZ invite_code.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, bio, avatar_url, created_at, dietary_prefs, travel_interests, onboarding_completed,
  cookie_consent, cookie_consent_at, first_name, profiling_consent, profiling_consent_at,
  home_country, home_city, deleted_at, deleted_by, deletion_reason
) ON public.profiles TO anon, authenticated;
