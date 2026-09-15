-- Zdalna konfiguracja aplikacji: brama minimalnej wersji ("hamulec awaryjny" po premierze).
--
-- Po publikacji w App Store stare wersje zyja na telefonach tygodniami, a poprawka przechodzi
-- review 1-2 dni. Ta tabela pozwala BEZ nowego builda powiedziec starym wersjom: "zaktualizuj
-- sie" (mode = 'nag', do odlozenia) albo "ta wersja nie dziala, zaktualizuj, zeby wejsc"
-- (mode = 'block'). Klient czyta ja przy starcie i po powrocie do aplikacji, porownuje
-- z wlasnym numerem builda (CFBundleVersion) i w razie potrzeby pokazuje ekran aktualizacji.
-- Blad odczytu NIGDY nie blokuje (fail-open) - zla konfiguracja nie moze wylaczyc aplikacji.
--
-- Zapis: WYLACZNIE z SQL / service role - klient nie ma zadnej polityki INSERT/UPDATE.
-- Podniesienie progu, przyklad (build 8 i starsze maja sie zaktualizowac, twardo):
--   update app_config set value = jsonb_set(value, '{min_build}', '9') where key = 'ios_update';
--   update app_config set value = jsonb_set(value, '{mode}', '"block"') where key = 'ios_update';
-- Wlasna tresc komunikatu: value.message (pl/en); null = domyslny tekst z aplikacji.

create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists "app_config: public read" on public.app_config;
create policy "app_config: public read" on public.app_config
  for select to anon, authenticated using (true);

grant select on public.app_config to anon, authenticated;

insert into public.app_config (key, value) values
  ('ios_update', jsonb_build_object(
      'min_build', 1,                     -- builds < min_build dostaja ekran aktualizacji
      'mode', 'block',                    -- 'block' (nie da sie wejsc) | 'nag' (da sie odlozyc)
      'store_url', 'https://apps.apple.com/app/id6777705751',
      'message', null                     -- {"pl": "...", "en": "..."} albo null
  )),
  ('android_update', jsonb_build_object(
      'min_build', 1, 'mode', 'block', 'store_url', null, 'message', null
  ))
on conflict (key) do nothing;

create or replace function public.touch_app_config_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists app_config_touch on public.app_config;
create trigger app_config_touch before update on public.app_config
  for each row execute function public.touch_app_config_updated_at();
