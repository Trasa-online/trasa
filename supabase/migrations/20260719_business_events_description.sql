-- Opcjonalny opis zaplanowanego wydarzenia (kolejka business_events). Tytul (<=40) +
-- daty zostaja wymagane; opis jest dodatkowy (np. szczegoly koncertu/promocji).
alter table public.business_events
  add column if not exists description text;
