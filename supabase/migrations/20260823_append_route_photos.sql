-- Wspolne wyjazdy: uczestnik (nie tylko host) moze dodawac zdjecia do galerii trasy.
-- routes UPDATE RLS = tylko wlasciciel (auth.uid()=user_id), wiec czlonek grupy nie moze
-- bezposrednio dopisac do routes.review_photos. Ta funkcja (SECURITY DEFINER) dopisuje URL-e
-- zdjec, jesli wolajacy jest wlascicielem trasy LUB czlonkiem jej sesji grupowej.
create or replace function public.append_route_photos(p_route_id uuid, p_urls text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_session uuid;
begin
  select user_id, group_session_id into v_owner, v_session
    from public.routes where id = p_route_id;

  if v_owner is null then
    raise exception 'route not found';
  end if;

  if v_owner <> auth.uid()
     and not (
       v_session is not null and exists (
         select 1 from public.group_session_members m
         where m.session_id = v_session and m.user_id = auth.uid()
       )
     ) then
    raise exception 'not allowed';
  end if;

  update public.routes
     set review_photos = coalesce(review_photos, '{}'::text[]) || coalesce(p_urls, '{}'::text[])
   where id = p_route_id;
end;
$$;

revoke all on function public.append_route_photos(uuid, text[]) from public, anon;
grant execute on function public.append_route_photos(uuid, text[]) to authenticated;
