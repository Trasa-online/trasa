-- Przywracanie zdjecia z kwarantanny ("falszywy alarm") + sprzatanie po 90 dniach.
--
-- Luka w pierwszej wersji logu: byl `context` (skad zdjecie), ale NIE bylo namiarow na
-- konkretny obiekt, wiec dalo sie odtworzyc plik, a nie referencje (do ktorego pinu / miejsca
-- / wyjazdu wrocic). `target` domyka kontrakt - wypelnia go klient przy moderacji:
--   place_photo  -> { place_key, place_name, city }
--   pin_photo    -> { route_id, place_name }
--   trip_gallery -> { route_id }
alter table public.image_moderation_log add column if not exists target jsonb;
alter table public.image_moderation_log add column if not exists restored_at timestamptz;
alter table public.image_moderation_log add column if not exists restored_url text;

-- Cron: raz na dobe kasuje wpisy i pliki starsze niz 90 dni. Same PLIKI kasuje edge function
-- (Storage API nie jest dostepne z SQL), wiec pg_cron tylko ja wola - tak samo jak przy pushach.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.purge_moderation_quarantine()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  secret text;
begin
  begin
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_trigger_secret' limit 1;
    if secret is null then return; end if;
    perform net.http_post(
      url := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/purge-moderation-quarantine',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', secret),
      body := jsonb_build_object('older_than_days', 90)
    );
  exception when others then
    -- sprzatanie nigdy nie moze wywrocic innej pracy bazy
    null;
  end;
end;
$function$;

select cron.unschedule('purge-moderation-quarantine') where exists (
  select 1 from cron.job where jobname = 'purge-moderation-quarantine'
);
select cron.schedule('purge-moderation-quarantine', '30 3 * * *', $$select public.purge_moderation_quarantine();$$);
