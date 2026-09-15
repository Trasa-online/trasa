-- Adresaci maila o premierze (funkcja edge send-launch-email, 2026-09-11).
--
-- Dlaczego SQL, a nie Admin API: auth.users ma ponad 1000 wierszy (goscie anonimowi),
-- a listowanie ich stronami z funkcji edge padalo ("Database error finding users") i bylo
-- niepotrzebnie ciezkie. Zlaczenie waitlist x auth.users po e-mailu w bazie jest dokladne
-- i natychmiastowe.
--
-- Zwraca wpisy waitlisty BEZ konta i BEZ notified_at (= mail o premierze jeszcze nie poszedl).
-- Dostep: service_role (funkcja edge) albo zalogowany admin (user_roles role='admin').

create or replace function public.admin_launch_recipients()
returns table (id uuid, email text, language text, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required';
  end if;

  return query
    select distinct on (lower(w.email)) w.id, w.email, w.language, w.created_at
    from public.waitlist w
    where w.notified_at is null
      and w.email is not null
      and not exists (select 1 from auth.users u where lower(u.email) = lower(w.email))
    order by lower(w.email), w.created_at asc;
end;
$$;

revoke all on function public.admin_launch_recipients() from public, anon;
grant execute on function public.admin_launch_recipients() to authenticated, service_role;
