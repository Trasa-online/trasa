-- ============================================================================
-- CZYSZCZENIE martwych tabel (pozostalosci po pivotach) - 2026-08-04.
-- Zweryfikowane: ZERO referencji w kodzie klienta i edge functions.
-- CASCADE usuwa tez zalezne polityki/triggery/FK z tych martwych tabel.
-- ⚠️ To DROP - zrob snapshot/backup w Supabase przed uruchomieniem.
-- ============================================================================

-- Social (lajki/komentarze) - caly narog src/components/social/ byl osierocony:
drop table if exists public.comment_likes  cascade;
drop table if exists public.comments       cascade;
drop table if exists public.likes          cascade;
drop table if exists public.pin_comments   cascade;
drop table if exists public.visit_comments cascade;
drop table if exists public.visit_likes    cascade;

-- Model pinow / discovery (martwy):
drop table if exists public.canonical_pins cascade;
drop function if exists public.find_nearby_canonical_pin cascade;
drop function if exists public.find_original_pin_creator cascade;
drop table if exists public.pin_visits     cascade;   -- "visited checklist" - nigdy niezaimplementowane w kodzie

-- UWAGA: pin_ratings ZOSTAJE! Mimo nazwy trzyma NOTKI miejsc (kolumna `note`),
-- ktore sa rdzeniem B2C (CLAUDE.md: "bazujemy WYLACZNIE na notkach"). Gwiazdki
-- (kolumna rating) usuniete z UI; sama tabela + notki musza zostac.

-- Stale / jednorazowe:
drop table if exists public.memory_embeddings cascade;  -- zastapione przez user_memory
drop table if exists public.pins_backup       cascade;  -- one-off snapshot

-- Fake door (strona trasatravel.com wygaszana):
drop table if exists public.fakedoor_leads cascade;
-- (usun tez edge function fakedoor-lead-email w Dashboard/CLI)

-- UWAGA: pins, pin_ratings? -> pins ZOSTAJE (rdzen tras). draft_conversions,
-- creator_places, demo_*, waitlist ZOSTAJA (uzywane; waitlist/demo/creator = web,
-- do rozwazenia osobno przy kill-web).
