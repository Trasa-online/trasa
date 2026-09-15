-- Data PUBLIKACJI wyjazdu (2026-08-31, zgloszenie Nat: wyjazd opublikowany dzisiaj wyladowal w
-- eksploracji ponizej wyjazdu opublikowanego wczesniej).
-- Przyczyna: feed sortowal po created_at, czyli po dacie ZALOZENIA trasy (poczatek planowania),
-- a nie po momencie, w ktorym trafila do eksploracji. Wyjazd planowany od 25.08 i opublikowany
-- 30.08 przegrywal z wyjazdem zalozonym 26.08.
alter table public.routes add column if not exists published_at timestamptz;

-- Backfill: dla juz opublikowanych bierzemy updated_at (publikacja byla ostatnia zmiana statusu).
update public.routes
set published_at = coalesce(updated_at, created_at)
where coalesce(status, 'draft') = 'published' and published_at is null;

-- Trigger: kazde przejscie w 'published' stempluje date, niezaleznie od sciezki (klient, admin, SQL).
create or replace function public.stamp_published_at()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.status, 'draft') = 'published'
     and coalesce(old.status, 'draft') is distinct from 'published'
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_routes_stamp_published_at on public.routes;
create trigger trg_routes_stamp_published_at
  before update on public.routes
  for each row execute function public.stamp_published_at();

create index if not exists routes_published_at_idx on public.routes (published_at desc nulls last);
