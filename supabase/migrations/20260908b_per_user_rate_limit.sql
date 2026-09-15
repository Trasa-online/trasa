-- Limit na osobe przed globalna kwota Google (2026-09-08, audyt M5)
--
-- google-places-proxy ma bezpiecznik KOSZTOWY (2500 wywolan/dzien globalnie), ale nie ma
-- bezpiecznika DOSTEPNOSCI: jeden skrypt z kluczem anon wypala caly dzienny budzet w kilka
-- minut i wyszukiwarka przestaje dzialac WSZYSTKIM. Limit per osoba zamienia awarie calej
-- apki na odciecie jednego naduzywajacego.
--
-- Dlaczego nie fn_throttle (uzyty w extract-creator-place): tamten wzorzec to SELECT count
-- + INSERT, czyli dwa round-tripy i wiersz na KAZDE wywolanie - przy proxy wolanym setki
-- razy na sesje to i koszt, i tabela rosnaca bez konca. Tutaj jeden wiersz na okno czasowe,
-- inkrementowany atomowo przez ON CONFLICT.

create table if not exists public.fn_rate_limit (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);
alter table public.fn_rate_limit enable row level security;
-- Zadnej polityki: pisze i czyta wylacznie funkcja SECURITY DEFINER ponizej.

/**
 * Zlicza jedno wywolanie w oknie czasowym. Zwraca false, gdy limit juz wyczerpany.
 * Atomowo (ON CONFLICT ... RETURNING), wiec rownolegle zadania nie przeskocza limitu.
 */
create or replace function public.try_consume_rate_limit(
  p_bucket text, p_limit integer, p_window_minutes integer default 60
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- Okno "kubelkowe", nie przesuwane: start liczymy od epoki, wiec wszystkie rownolegle
  -- wywolania w tej samej minucie trafiaja w ten sam wiersz.
  v_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );
  v_hits integer;
begin
  insert into public.fn_rate_limit (bucket, window_start, hits)
  values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = fn_rate_limit.hits + 1
  returning hits into v_hits;

  -- Sprzatanie starych okien. Raz na jakis czas (losowo), zeby nie robic tego przy kazdym
  -- wywolaniu - tabela i tak ma tylko jeden wiersz na kubelek na okno.
  if random() < 0.001 then
    delete from public.fn_rate_limit where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end; $$;

revoke execute on function public.try_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.try_consume_rate_limit(text, integer, integer) to service_role;

-- fn_throttle rosla bez konca i bez indeksu (extract-creator-place robi po niej COUNT
-- z filtrem po buckecie i czasie).
create index if not exists fn_throttle_bucket_created_idx on public.fn_throttle (bucket, created_at desc);
delete from public.fn_throttle where created_at < now() - interval '7 days';
