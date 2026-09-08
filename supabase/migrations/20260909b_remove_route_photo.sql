-- Uczestnik wspolnego wyjazdu moze usunac ZDJECIE, ktore sam dodal.
--
-- Zgloszenie Nat 2026-09-09: kosz w podgladzie zdjecia ma byc dostepny "u uzytkownikow".
-- Dotad byl schowany za `isOwner` - i slusznie, bo usuwanie szlo zwyklym UPDATE na `routes`,
-- a polityka RLS przepuszcza tam tylko wlasciciela. Powstala asymetria: uczestnik MOGL dodac
-- zdjecie (przez append_route_photos, SECURITY DEFINER), ale nie mogl go cofnac.
--
-- Kto jest autorem zdjecia poznajemy po SCIEZCE W STORAGE: handleAddPhotos zapisuje plik jako
-- "<user_id>/<route_id>/gal_...", wiec identyfikator wgrywajacego siedzi w adresie. Nie trzeba
-- osobnej tabeli - wystarczy sprawdzic prefiks. Wlasciciel wyjazdu usuwa dowolne zdjecie
-- (odpowiada za galerie), uczestnik wylacznie swoje.
--
-- Plik w Storage ZOSTAJE - w interfejsie jest "Cofnij", ktore przywraca adres do galerii.

create or replace function public.remove_route_photo(p_route_id uuid, p_url text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_owner uuid; v_session uuid; v_is_member boolean; v_mine boolean;
begin
  select user_id, group_session_id into v_owner, v_session
    from public.routes where id = p_route_id;
  -- Bez tego sprawdzenia funkcja jest otwarta dla niezalogowanego: "v_owner <> auth.uid()"
  -- daje wtedy NULL, a "NULL and ..." nie jest prawda, wiec IF ponizej NIE wchodzi i wyjatek
  -- nigdy nie leci. Zlapane testem podczas wdrozenia (2026-09-09).
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_owner is null then raise exception 'route not found'; end if;
  if coalesce(p_url, '') = '' then return false; end if;

  v_is_member := v_session is not null and exists (
    select 1 from public.group_session_members m
    where m.session_id = v_session and m.user_id = auth.uid()
  );
  -- "<user_id>/<route_id>/..." w sciezce pliku = to zdjecie wgral ten user.
  v_mine := position('/' || auth.uid()::text || '/' || p_route_id::text || '/' in p_url) > 0;

  if v_owner <> auth.uid() and not (v_is_member and v_mine) then
    raise exception 'not allowed';
  end if;

  update public.routes
     set review_photos = array_remove(coalesce(review_photos, '{}'::text[]), p_url)
   where id = p_route_id;
  return true;
end; $$;

-- Supabase nadaje nowym funkcjom EXECUTE dla anon i authenticated przez domyslne uprawnienia,
-- wiec samo "revoke from public" ich NIE zdejmuje - anon trzeba odebrac wprost.
revoke all on function public.remove_route_photo(uuid, text) from public, anon;
grant execute on function public.remove_route_photo(uuid, text) to authenticated;

-- Przywrocenie po "Cofnij" ta sama droga - uczestnik nie ma UPDATE na `routes`, wiec bez tego
-- cofniecie dzialaloby tylko wlascicielowi.
create or replace function public.restore_route_photo(p_route_id uuid, p_url text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_owner uuid; v_session uuid; v_is_member boolean; v_mine boolean;
begin
  select user_id, group_session_id into v_owner, v_session
    from public.routes where id = p_route_id;
  -- Bez tego sprawdzenia funkcja jest otwarta dla niezalogowanego: "v_owner <> auth.uid()"
  -- daje wtedy NULL, a "NULL and ..." nie jest prawda, wiec IF ponizej NIE wchodzi i wyjatek
  -- nigdy nie leci. Zlapane testem podczas wdrozenia (2026-09-09).
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_owner is null then raise exception 'route not found'; end if;
  if coalesce(p_url, '') = '' then return false; end if;

  v_is_member := v_session is not null and exists (
    select 1 from public.group_session_members m
    where m.session_id = v_session and m.user_id = auth.uid()
  );
  v_mine := position('/' || auth.uid()::text || '/' || p_route_id::text || '/' in p_url) > 0;

  if v_owner <> auth.uid() and not (v_is_member and v_mine) then
    raise exception 'not allowed';
  end if;

  update public.routes
     set review_photos = case
       when p_url = any(coalesce(review_photos, '{}'::text[])) then review_photos
       else coalesce(review_photos, '{}'::text[]) || array[p_url]
     end
   where id = p_route_id;
  return true;
end; $$;

revoke all on function public.restore_route_photo(uuid, text) from public, anon;
grant execute on function public.restore_route_photo(uuid, text) to authenticated;
