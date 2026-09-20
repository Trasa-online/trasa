-- PRAWDZIWY rachunek Google Cloud w panelu ops (prosba Nat 2026-09-20: "chce widziec tylko
-- realne kwoty do zaplaty, w PLN"). Do tej pory "Koszty API" mnozyly nasz licznik wywolan
-- Text Search przez cennik katalogowy ($32/1000) od pierwszego wywolania - bez darmowej puli
-- Google i bez innych SKU (geokodowanie, Maps JS, zdjecia). Panel pokazywal $52, faktura 23,85 zl.
-- Zrodlo prawdy = eksport rozliczen do BigQuery (konto rozliczeniowe -> zbior `billing` w projekcie
-- gentle-scene-474817-r1); funkcja brzegowa `google-billing-sync` dociaga go raz dziennie tutaj.

create table if not exists public.google_billing_daily (
  day         date        not null,
  project_id  text        not null default '',
  service     text        not null,
  sku         text        not null,
  cost        numeric(12,4) not null default 0,   -- koszt katalogowy w walucie konta
  credits     numeric(12,4) not null default 0,   -- rabaty i darmowa pula (ujemne w eksporcie; tu jako wartosc dodatnia)
  currency    text        not null default 'PLN',
  synced_at   timestamptz not null default now(),
  primary key (day, project_id, service, sku)
);
comment on table public.google_billing_daily is
  'Dzienny koszt Google Cloud per SKU z eksportu rozliczen do BigQuery (google-billing-sync). Do zaplaty = cost - credits.';

alter table public.google_billing_daily enable row level security;
-- Bez polityk: pisze service_role (funkcja brzegowa), czyta panel przez SECDEF RPC ponizej.

-- Panel ops: ostatnie 3 miesiace, tylko admin.
create or replace function public.google_billing_summary()
returns table(day date, project_id text, service text, sku text, cost numeric, credits numeric, currency text, synced_at timestamptz)
language sql security definer set search_path to 'public' as $$
  select day, project_id, service, sku, cost, credits, currency, synced_at
  from public.google_billing_daily
  where day >= (date_trunc('month', (now() at time zone 'utc')::date) - interval '2 months')::date
    and (has_role(auth.uid(), 'admin'::app_role) or auth.role() = 'service_role')
  order by day desc, service, sku;
$$;
revoke execute on function public.google_billing_summary() from public, anon;
grant execute on function public.google_billing_summary() to authenticated;

-- Cron: raz dziennie o 4:20 UTC (eksport Google dosypuje dane kilka razy na dobe, ostatnie
-- wiersze za wczoraj sa zwykle przed poludniem czasu PL - synchronizacja bierze 40 dni wstecz
-- i upsertuje, wiec spoznione korekty Google i tak dojada nastepnego dnia).
create or replace function public.cron_google_billing_sync()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_secret text;
begin
  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_trigger_secret' limit 1;
  exception when others then v_secret := null;
  end;
  perform net.http_post(
    url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/google-billing-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', coalesce(v_secret, '')),
    body    := '{}'::jsonb,
    -- Token Google + dwa zapytania BigQuery trwaja ~10-20 s; domyslne 5 s pg_net ucinalo polaczenie.
    timeout_milliseconds := 90000
  );
end; $$;
revoke execute on function public.cron_google_billing_sync() from public, anon, authenticated;

select cron.schedule('google-billing-sync', '20 4 * * *', 'select public.cron_google_billing_sync();');
