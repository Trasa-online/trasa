-- ============================================================================
-- AUDYT BEZPIECZENSTWA 2026-08-04 - poprawki HIGH
-- SEKCJA A (bezpieczna, aplikowac od razu): H7, H1, throttle, RPC, VIEW.
-- SEKCJA B (na koncu, ZAKOMENTOWANA): DROP/REVOKE psujace stary build -
--          aplikowac PO rebuildzie apki natywnej z przepietymi odczytami.
-- ============================================================================

-- ── throttle (H5/H6): trwaly rate-limit publicznych funkcji ──
create table if not exists public.fn_throttle (
  id         uuid primary key default gen_random_uuid(),
  bucket     text not null,
  created_at timestamptz not null default now()
);
create index if not exists fn_throttle_bucket_idx on public.fn_throttle (bucket, created_at desc);
alter table public.fn_throttle enable row level security;   -- brak polityk = deny anon/auth; service_role omija.

-- ── H7: route_examples - anon mial pelny CRUD (polityka bez TO service_role) ──
drop policy if exists "Service role full access" on public.route_examples;
drop policy if exists "Authenticated can propose route examples" on public.route_examples;
create policy "Authenticated can propose route examples" on public.route_examples
  for insert to authenticated
  with check (auth.uid() is not null and is_approved = false and is_rejected = false);
-- SELECT approved zostaje ("Anyone can read approved route examples").

-- ── H1: business_profiles - impersonacja/przejecie wizytowki ──
-- Nie-admin/nie-service NIE ustawi place_id / is_verified / is_active /
-- moderation_status / owner_user_id. Wstrzyknieta wizytowka nie ma place_id,
-- wiec nigdzie sie nie pokaze. Legalny flow (draft self-service, edycja
-- dashboardu, admin/edge z service_role) dziala bez zmian.
create or replace function public.guard_business_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  privileged boolean := (auth.role() = 'service_role') or has_role(auth.uid(), 'admin'::app_role);
begin
  if privileged then return new; end if;
  if tg_op = 'INSERT' then
    new.place_id := null;
    new.owner_user_id := auth.uid();
    new.is_verified := false;
    new.is_active := false;
    new.moderation_status := 'pending';
  elsif tg_op = 'UPDATE' then
    new.place_id := old.place_id;
    new.owner_user_id := old.owner_user_id;
    new.is_verified := old.is_verified;
    new.is_active := old.is_active;
    new.moderation_status := old.moderation_status;
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_business_profile on public.business_profiles;
create trigger trg_guard_business_profile
  before insert or update on public.business_profiles
  for each row execute function public.guard_business_profile();

-- ── H2: publiczny widok wizytowek BEZ kolumn wrazliwych ──
-- Konsumenci czytaja business_profiles_public (bez email/preview_token/promo_code/
-- moderation_note/moderated_by). Wlasciciel/admin czytaja baze przez RLS (bez zmian).
drop view if exists public.business_profiles_public;
create view public.business_profiles_public with (security_invoker = true) as
  select id, place_id, owner_user_id, business_name, logo_url, cover_image_url, cover_video_url,
         gallery_urls, menu_image_urls, website, booking_url, description, opening_hours, social_links,
         is_verified, is_premium, is_active, promo_title, promo_description, promo_expires_at,
         phone, address, street, city, postal_code, tags,
         main_category, secondary_category, subcategories,
         color_badge, color_card_bg, color_button, color_promo, latitude, longitude,
         event_title, event_title_en, event_description, event_starts_at, event_ends_at
  from public.business_profiles
  where is_active = true and is_draft = false;
grant select on public.business_profiles_public to anon, authenticated;

-- ── H3: RPC dla wlasciciela (SECURITY DEFINER omija REVOKE z sekcji B) ──
create or replace function public.get_my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;
grant execute on function public.get_my_profile() to authenticated;

-- ============================================================================
-- SEKCJA B - ⚠️ URUCHOMIC OSOBNO DOPIERO PO REBUILDZIE apki natywnej
-- (z przepietymi odczytami: business_profiles_public + get_my_profile).
-- Inaczej stary build dostanie pusto/permission-denied.
-- ============================================================================
-- H2: odetnij publiczny SELECT surowej tabeli (zostaja owner + admin RLS):
--   DROP POLICY "Anyone can read business profiles"  ON public.business_profiles;
--   DROP POLICY "Anyone can read business_profiles"  ON public.business_profiles;
--
-- H3: ukryj invite_code i powody usuniecia konta przed anon+authenticated
--   (admin czyta deleted_at, nie te kolumny; odczyty cudzych profili ich nie biora):
--   REVOKE SELECT (invite_code, deleted_by, deletion_reason) ON public.profiles FROM anon, authenticated;
