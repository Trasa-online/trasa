-- Notify admins on every new waitlist signup
-- Uses pg_net to fire an HTTP POST to the notify-waitlist-signup edge function

-- 1. Enable pg_net (idempotent)
create extension if not exists pg_net with schema extensions;

-- 2. Trigger function
create or replace function public.notify_waitlist_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_url text := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/notify-waitlist-signup';
  service_role text := current_setting('app.settings.service_role_key', true);
  total_count int;
begin
  -- Count total waitlist entries to include in notification
  select count(*) into total_count from public.waitlist;

  -- Fire-and-forget HTTP POST to edge function
  perform extensions.http_post(
    url := edge_url,
    body := jsonb_build_object(
      'email', new.email,
      'created_at', new.created_at,
      'count', total_count
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role
    )
  );

  return new;
exception when others then
  -- Never block the insert if notification fails
  raise warning 'notify_waitlist_signup failed: %', sqlerrm;
  return new;
end;
$$;

-- 3. Drop existing trigger if present, then create
drop trigger if exists waitlist_notify_admin_trigger on public.waitlist;
create trigger waitlist_notify_admin_trigger
  after insert on public.waitlist
  for each row execute function public.notify_waitlist_signup();
