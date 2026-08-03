-- ============================================================================
-- KOREKTA poprawek HIGH (2026-08-04) - po weryfikacji na produkcji:
--  * H2: widok mial security_invoker=true -> po drop polityk publicznych zwracal
--        PUSTO dla anon (wizytowki znikaly). Poprawka: widok jako DEFINER.
--  * H3: kolumnowy REVOKE invite_code byl nieskuteczny (table-level GRANT go
--        pokrywa). Zamiast ukrywac kolumne - utwardzamy befriend_via_invite
--        (blok goscia + rate-limit), co zabija realne ryzyko (masowe wymuszanie
--        znajomosci). invite_code staje sie nieszkodliwy.
-- ============================================================================

-- ── H2 FIX: publiczny widok jako DEFINER (bez security_invoker) ──
drop view if exists public.business_profiles_public;
create view public.business_profiles_public as
  select id, place_id, owner_user_id, business_name, logo_url, cover_image_url, cover_video_url,
         gallery_urls, menu_image_urls, website, booking_url, description, opening_hours, social_links,
         is_verified, is_premium, is_active, promo_title, promo_description, promo_expires_at,
         phone, address, street, city, postal_code, tags, main_category, secondary_category, subcategories,
         color_badge, color_card_bg, color_button, color_promo, latitude, longitude,
         event_title, event_title_en, event_description, event_starts_at, event_ends_at
  from public.business_profiles
  where is_active = true and is_draft = false;
grant select on public.business_profiles_public to anon, authenticated;

-- ── H3 FIX: utwardz befriend_via_invite (blok goscia + rate-limit 20/24h) ──
create or replace function public.befriend_via_invite(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare me uuid := auth.uid(); inviter uuid; ex record; recent int;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  -- blok kont anonimowych (gosci) - realny user musi byc zalogowany na koncie
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'guest_not_allowed');
  end if;
  -- rate-limit: max 20 dodan przez invite / 24h / user (liczy tez nieudane proby)
  select count(*) into recent from public.fn_throttle
    where bucket = 'bef:' || me::text and created_at > now() - interval '24 hours';
  if recent >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.fn_throttle (bucket) values ('bef:' || me::text);

  perform public.ensure_current_user_profile();
  select id into inviter from public.profiles where invite_code = p_code;
  if inviter is null then return jsonb_build_object('ok', false, 'reason', 'invalid_code'); end if;
  if inviter = me then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  select * into ex from public.friendships
    where (requester_id = me and addressee_id = inviter)
       or (requester_id = inviter and addressee_id = me) limit 1;
  if ex.id is not null then
    if ex.status <> 'accepted' then
      update public.friendships set status='accepted', accepted_at=now() where id = ex.id;
    end if;
    return jsonb_build_object('ok', true, 'inviter', inviter, 'already', true);
  end if;
  insert into public.friendships (requester_id, addressee_id, status, accepted_at)
    values (inviter, me, 'accepted', now());
  insert into public.notifications (user_id, type, actor_id)
    values (inviter, 'friend_accept'::public.notification_type, me);
  return jsonb_build_object('ok', true, 'inviter', inviter);
end;
$function$;

-- Uwaga: nieskuteczny REVOKE z sekcji B zostaje (nieszkodliwy). Wyciek
-- deleted_by/deletion_reason (dane moderacji) -> przeniesc do batcha MEDIUM.
