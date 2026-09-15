-- Podglad zapisow na premiere w gornym pasku panelu ops (zgloszenie Nat 2026-09-11:
-- "nie aktualizuje na biezaco waitlisty i sa tam maile osob, ktore juz maja konta").
--
-- Dotad panel czytal `waitlist` wprost i pokazywal WSZYSTKIE wiersze, takze te po
-- konwersji - a to jest inna liczba niz "ile osob jeszcze czeka". Rozdzielenie
-- wymaga zajrzenia do auth.users, do ktorego klient nie ma (i nie powinien miec)
-- dostepu, wiec liczy to funkcja SECURITY DEFINER za bramka roli 'admin'
-- (ten sam wzor co admin_list_users).
--
-- Zwraca: { waiting, converted, rows: [{email, created_at, source}] }
-- `rows` to WYLACZNIE osoby bez konta, od najnowszych.

create or replace function public.admin_waitlist_peek(p_limit int default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_waiting   bigint;
  v_converted bigint;
  v_rows      jsonb;
begin
  if not exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required';
  end if;

  select count(*) filter (where u.id is null),
         count(*) filter (where u.id is not null)
    into v_waiting, v_converted
  from public.waitlist w
  left join auth.users u on lower(u.email) = lower(w.email);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select w.email, w.created_at, w.source
    from public.waitlist w
    where not exists (
      select 1 from auth.users u where lower(u.email) = lower(w.email)
    )
    order by w.created_at desc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ) x;

  return jsonb_build_object('waiting', v_waiting, 'converted', v_converted, 'rows', v_rows);
end;
$$;

-- Supabase domyslnie nadaje EXECUTE roli `anon`; samo `revoke from public` tego NIE zdejmuje.
revoke all on function public.admin_waitlist_peek(int) from public, anon;
grant execute on function public.admin_waitlist_peek(int) to authenticated;
