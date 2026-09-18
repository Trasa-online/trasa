-- Tlumaczenie tresci userow NA ZADANIE (decyzja Nat 2026-09-18): notki przy miejscach, opisy
-- wyjazdow i kolekcji dostaja guzik "Przetlumacz". Silnik: Claude Haiku bezposrednio przez
-- API Anthropica (funkcja brzegowa `translate-text`), BEZ bramki Lovable.
--
-- Dwie tabele:
--  * `translations` - CACHE: ta sama tresc w tym samym jezyku docelowym tlumaczy sie RAZ,
--    niezaleznie od tego, ilu userow ja otworzy. Klucz = sha256(znormalizowana tresc) + jezyk.
--    Odczyt: zalogowani (cache jest wspolny - tresc i tak jest publiczna albo dla uczestnikow);
--    zapis: WYLACZNIE service role (funkcja brzegowa). Klient nie moze podrzucic "tlumaczenia".
--  * `translation_requests` - dziennik do LIMITOW (prosba Nat: "zeby nie bylo naduzyc").
--    Bez zadnej polityki RLS = niewidoczna dla klienta; czyta i pisze ja tylko SECDEF ponizej.
--
-- Limity (`claim_translation_quota`): 30 tlumaczen/h i 150/dobe na usera, 20 000 znakow/dobe
-- na usera, 3 000 tlumaczen/dobe globalnie. Trafienie w cache NIE zuzywa limitu. Przy Haiku
-- (~0,0002 USD za notke) globalny limit to sufit ~0,6 USD dziennie nawet przy nadużyciu.

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null,
  target_lang text not null,
  source_text text not null,
  translated text not null,
  model text,
  created_at timestamptz not null default now(),
  unique (source_hash, target_lang)
);
alter table public.translations enable row level security;
drop policy if exists translations_read on public.translations;
create policy translations_read on public.translations for select to authenticated using (true);
revoke all on public.translations from anon;
grant select on public.translations to authenticated;

create table if not exists public.translation_requests (
  id bigserial primary key,
  user_id uuid not null,
  chars int not null,
  created_at timestamptz not null default now()
);
create index if not exists translation_requests_user_idx on public.translation_requests (user_id, created_at desc);
create index if not exists translation_requests_created_idx on public.translation_requests (created_at desc);
alter table public.translation_requests enable row level security;
revoke all on public.translation_requests from anon, authenticated;

-- Rezerwacja limitu: sprawdza progi i od razu dopisuje wpis (jedna transakcja, wiec dwa
-- rownolegle zadania nie przeskocza limitu o wiecej niz o jeden).
create or replace function public.claim_translation_quota(p_user uuid, p_chars int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour int; v_day int; v_day_chars int; v_global int;
begin
  if p_user is null then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  select count(*) into v_hour from translation_requests where user_id = p_user and created_at > now() - interval '1 hour';
  if v_hour >= 30 then return jsonb_build_object('ok', false, 'reason', 'user_hour'); end if;
  select count(*), coalesce(sum(chars), 0) into v_day, v_day_chars from translation_requests where user_id = p_user and created_at > now() - interval '1 day';
  if v_day >= 150 or v_day_chars + p_chars > 20000 then return jsonb_build_object('ok', false, 'reason', 'user_day'); end if;
  select count(*) into v_global from translation_requests where created_at > now() - interval '1 day';
  if v_global >= 3000 then return jsonb_build_object('ok', false, 'reason', 'global_day'); end if;
  insert into translation_requests (user_id, chars) values (p_user, p_chars);
  return jsonb_build_object('ok', true);
end $$;
-- Wola ja WYLACZNIE funkcja brzegowa (service role) - z klienta ma byc niewidoczna.
revoke execute on function public.claim_translation_quota(uuid, int) from public, anon, authenticated;

-- Dziennik limitow potrzebny jest tylko na dobe wstecz - starsze wpisy sprzata cron.
create or replace function public.purge_translation_requests()
returns void language sql security definer set search_path = public as $$
  delete from public.translation_requests where created_at < now() - interval '7 days';
$$;
revoke execute on function public.purge_translation_requests() from public, anon, authenticated;
select cron.schedule('purge-translation-requests', '45 3 * * *', 'select public.purge_translation_requests();');
