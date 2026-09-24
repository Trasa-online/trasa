-- PRZYPOMNIENIA DLA LOKALI, KTORE UTKNELY W REJESTRACJI (decyzja Nat 2026-09-21).
--
-- Do tej pory flow B2B mial trzy maile transakcyjne (aktywacja, powitanie po zatwierdzeniu,
-- reset hasla) i ZADNEGO przypomnienia - lokal, ktory nie kliknal linku aktywacyjnego albo
-- aktywowal konto i nie wypelnil wizytowki, znikal po cichu („Oter Coffeebar", 20.09: mail
-- aktywacyjny wyslany, link nigdy nie uzyty, wizytowka pusta, w kolejce moderacji na zawsze).
--
-- Funkcja brzegowa `business-nudges` (cron raz dziennie) wysyla trzy rodzaje maili:
--   activation_1     - 48 h od rejestracji (Nat: nie 24 h), konto nieaktywowane (nowy link - stary wygasl),
--   activation_2     - 4 dni od rejestracji, nadal nieaktywowane (ostatnie przypomnienie),
--   complete_profile - 2 dni od aktywacji, wizytowka niekompletna i jeszcze niezatwierdzona.
-- Ta tabela jest pamiecia „co juz poszlo": UNIQUE (wizytowka, rodzaj) = kazdy nudge najwyzej raz.

create table if not exists public.business_nudges (
  id                  uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  kind                text not null check (kind in ('activation_1', 'activation_2', 'complete_profile')),
  email               text,
  sent_at             timestamptz not null default now(),
  unique (business_profile_id, kind)
);
alter table public.business_nudges enable row level security;
-- Zadnych polityk: pisze i czyta wylacznie service_role (funkcja brzegowa). Admin patrzy w panelu
-- ops przez service_role / SECDEF, gdy bedzie potrzeba.
revoke all on public.business_nudges from public, anon, authenticated;

-- Cron: 8:00 UTC = 10:00 czasu polskiego latem (9:00 zima) - rano, gdy lokal czyta poczte.
create or replace function public.cron_business_nudges()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_secret text;
begin
  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_trigger_secret' limit 1;
  exception when others then v_secret := null;
  end;
  perform net.http_post(
    url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/business-nudges',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', coalesce(v_secret, '')),
    body    := '{}'::jsonb,
    -- Kilka maili przez Resend + generowanie linkow: domyslne 5 s pg_net to za malo.
    timeout_milliseconds := 60000
  );
end; $$;
revoke execute on function public.cron_business_nudges() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'business-nudges';
select cron.schedule('business-nudges', '0 8 * * *', 'select public.cron_business_nudges();');
