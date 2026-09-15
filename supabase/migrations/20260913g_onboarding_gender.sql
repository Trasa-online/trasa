-- Plec w ankiecie onboardingu (prosba Nat 2026-09-13: wybor plci na ekranie profilu).
-- Trafia do onboarding_responses (dane ankietowe, RLS "swoje wiersze"), NIE do profiles -
-- to nie jest informacja publiczna, a profiles ma kolumnowe granty, ktorych nie rozszerzamy.
alter table public.onboarding_responses
  add column if not exists gender text
  check (gender is null or gender in ('female', 'male', 'other', 'undisclosed'));

comment on column public.onboarding_responses.gender is
  'Plec z ankiety onboardingu: female | male | other | undisclosed (Wole nie podawac). NULL = sprzed 2026-09-13.';
