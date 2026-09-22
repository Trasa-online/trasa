-- ZNAJOMOSC WYMAGA ZGODY: zaproszenie -> akceptacja albo odmowa (decyzja Nat 2026-09-22).
--
-- Do dzisiaj (migracja `20260917a`) znajomy = WZAJEMNA OBSERWACJA: odwzajemnienie obserwacji
-- z grzecznosci samo z siebie dawalo komus dostep do tresci "tylko dla znajomych", a jedynym
-- odcieciem bylo ciche wykluczenie (`friend_excludes`). Teraz relacja jest jawna i obustronna:
--   * wyslanie zaproszenia ZAWSZE zaklada obserwacje - gdy druga strona odmowi, zostaje
--     dokladnie to i nic wiecej ("przy odrzuceniu osoba ktora wysyla request moze jedynie
--     obserwowac usera"),
--   * akceptacja robi obserwacje w DRUGA strone, wiec znajomi nadal obserwuja sie wzajemnie
--     (feed i podpowiedzi przy zapraszaniu dzialaja jak dotad),
--   * odmowa jest CICHA: zapraszajacy nie dostaje powiadomienia i nie widzi odrzuconego
--     wiersza (polityka SELECT go przed nim chowa), wiec jego ekran po prostu wraca do
--     "Dodaj do znajomych".
--
-- ⚠️ ISTNIEJACE 25 PAR WZAJEMNYCH ZOSTAJE ZNAJOMYMI (backfill nizej, `source='mutual_follow'`).
-- Inaczej 5 zdjec "tylko dla znajomych" z dnia na dzien przestaloby byc dla kogokolwiek
-- widoczne, a licznik "Znajomi" na kazdym profilu spadlby do zera - czyli zmiana zasad
-- zabralaby ludziom relacje, ktore wedlug POPRZEDNICH zasad juz mieli. Wycofanie tego jednym
-- zapytaniem: delete from friendships where source='mutual_follow'.
--
-- ⛔ `friend_excludes` (0 wierszy na prodzie) ZOSTAJE w bazie, ale nic go juz nie czyta -
-- przy jawnej znajomosci wypisanie sie to zwykle `remove_friend`. Tabeli nie kasujemy, bo
-- testerzy siedza na starszych buildach z TestFlight, a tamten kod jeszcze do niej pisze.

-- ── schemat ────────────────────────────────────────────────────────────────────
alter table public.friendships drop constraint if exists friendships_status_check;
alter table public.friendships add constraint friendships_status_check
  check (status = any (array['pending'::text, 'accepted'::text, 'declined'::text]));

alter table public.friendships add column if not exists declined_at timestamptz;
alter table public.friendships add column if not exists source text not null default 'request';
alter table public.friendships drop constraint if exists friendships_source_check;
alter table public.friendships add constraint friendships_source_check
  check (source = any (array['request'::text, 'invite_link'::text, 'mutual_follow'::text]));

-- Istniejacy unikat jest KIERUNKOWY (requester, addressee), wiec sam nie zatrzymalby drugiego
-- wiersza zalozonego "w druga strone". Para ma miec najwyzej jeden wiersz, niezaleznie od tego,
-- kto zaczal.
create unique index if not exists friendships_pair_uniq
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ⚠️ ODRZUCONE zaproszenie widzi WYLACZNIE ten, kto odrzucil. Gdyby zapraszajacy czytal ten
-- wiersz, dowiadywalby sie z niego o odmowie - a ma sie o niej nie dowiedziec.
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated
  using (addressee_id = auth.uid() or (requester_id = auth.uid() and status <> 'declined'));

-- Zapis wylacznie przez funkcje ponizej (brak polityk INSERT/UPDATE/DELETE).

-- ── pomocnicze ─────────────────────────────────────────────────────────────────
-- Obserwacja zalozona przy zaproszeniu/akceptacji NIE ma wlasnego powiadomienia: odbiorca
-- dostaje w tej samej chwili "chce dodac Cie do znajomych" i "zaczal Cie obserwowac" bylo by
-- drugim pushem o tym samym zdarzeniu. Flaga jest transakcyjna, jak `trasa.note_sync`.
create or replace function public.friend_follow(p_from uuid, p_to uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('trasa.friend_flow', '1', true);
  insert into public.followers (follower_id, following_id) values (p_from, p_to)
  on conflict do nothing;
  perform set_config('trasa.friend_flow', '', true);
end; $$;

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(current_setting('trasa.friend_flow', true), '') = '1' then return new; end if;
  insert into public.notifications (user_id, type, actor_id)
  values (new.following_id, 'follower'::public.notification_type, new.follower_id);
  return new;
end; $$;

-- Dedup 5 minut na (odbiorca, autor, typ) - chroni przed podwojnym tapnieciem i przed
-- seria powiadomien, gdy ktos wysyla zaproszenie ponownie po odmowie.
create or replace function public.notify_friend(p_user uuid, p_actor uuid, p_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.notifications n
    where n.user_id = p_user and n.actor_id = p_actor
      and n.type = p_type::public.notification_type
      and n.created_at > now() - interval '5 minutes'
  ) then return; end if;
  insert into public.notifications (user_id, type, actor_id)
  values (p_user, p_type::public.notification_type, p_actor);
end; $$;

-- ── definicja znajomosci ───────────────────────────────────────────────────────
-- ⚠️ Tej funkcji uzywaja polityki RLS na `pin_photos` i `route_friend_photos` (obie `to
-- authenticated`, wiec anon jej nie wola i nie potrzebuje grantu - patrz pulapka z migracji
-- 20260916b).
create or replace function public.are_friends(u1 uuid, u2 uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select u1 is not null and u2 is not null and u1 <> u2 and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = u1 and f.addressee_id = u2)
        or (f.requester_id = u2 and f.addressee_id = u1))
  );
$$;

create or replace function public.friend_ids(p_user uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when f.requester_id = p_user then f.addressee_id else f.requester_id end
  from public.friendships f
  where f.status = 'accepted' and (f.requester_id = p_user or f.addressee_id = p_user);
$$;

-- ── zaproszenie ────────────────────────────────────────────────────────────────
-- Zwraca: requested | accepted | pending | already_friends | guest_not_allowed | unavailable.
-- ⚠️ Po odmowie mozna sprobowac jeszcze raz. Swiadomie, bo alternatywy sa gorsze: blokada na
-- stale zdradza odmowe (guzik przestaje dzialac), a cicha blokada klamie ("wyslano", a nic nie
-- poszlo). Przed nagabywaniem chroni to, czym chroni w calej apce - zablokowanie osoby.
create or replace function public.send_friend_request(p_addressee uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ex record;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return 'guest_not_allowed'; end if;
  if p_addressee is null or me = p_addressee then return 'unavailable'; end if;
  -- Konto lokalu nie jest czlowiekiem w apce (migracja 20260921d).
  if exists (select 1 from public.profiles where id in (me, p_addressee) and is_business) then
    return 'unavailable';
  end if;
  perform public.ensure_current_user_profile();

  select * into ex from public.friendships
  where (requester_id = me and addressee_id = p_addressee)
     or (requester_id = p_addressee and addressee_id = me)
  limit 1;

  perform public.friend_follow(me, p_addressee);

  if ex.id is not null then
    if ex.status = 'accepted' then return 'already_friends'; end if;
    if ex.status = 'pending' and ex.requester_id = me then return 'pending'; end if;
    if ex.status = 'pending' and ex.requester_id = p_addressee then
      -- Obie strony chca tego samego, wiec nie ma na co czekac.
      update public.friendships
        set status = 'accepted', accepted_at = now(), declined_at = null
        where id = ex.id;
      perform public.friend_follow(p_addressee, me);
      perform public.notify_friend(p_addressee, me, 'friend_accept');
      return 'accepted';
    end if;
    update public.friendships
      set requester_id = me, addressee_id = p_addressee, status = 'pending',
          declined_at = null, accepted_at = null, created_at = now(), source = 'request'
      where id = ex.id;
  else
    insert into public.friendships (requester_id, addressee_id, status, source)
    values (me, p_addressee, 'pending', 'request');
  end if;

  perform public.notify_friend(p_addressee, me, 'friend_request');
  return 'requested';
end; $$;

-- ── odpowiedz ──────────────────────────────────────────────────────────────────
create or replace function public.respond_to_friend_request(p_requester uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_id uuid;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  select id into v_id from public.friendships
  where requester_id = p_requester and addressee_id = me and status = 'pending' limit 1;

  if v_id is null then
    -- Odpowiedziano juz z drugiego urzadzenia albo zapraszajacy sie rozmyslil - karta ma
    -- zniknac bez straszenia bledem.
    if public.are_friends(me, p_requester) then
      return jsonb_build_object('ok', true, 'status', 'accepted');
    end if;
    return jsonb_build_object('ok', false, 'status', 'gone');
  end if;

  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now() where id = v_id;
    perform public.friend_follow(me, p_requester);
    perform public.friend_follow(p_requester, me);
    perform public.notify_friend(p_requester, me, 'friend_accept');
    return jsonb_build_object('ok', true, 'status', 'accepted');
  end if;

  update public.friendships set status = 'declined', declined_at = now() where id = v_id;
  return jsonb_build_object('ok', true, 'status', 'declined');
end; $$;

-- Stara nazwa - zostaje, bo wola ja kod z buildow, ktore testerzy maja jeszcze na telefonach.
create or replace function public.accept_friend_request(p_requester uuid)
returns boolean language sql security definer set search_path = public as $$
  select coalesce((public.respond_to_friend_request(p_requester, true) ->> 'ok')::boolean, false);
$$;

-- ── zerwanie / cofniecie zaproszenia ───────────────────────────────────────────
-- Jedno wejscie na "cofam zaproszenie" i "usuwam ze znajomych". ⚠️ NIE odobserwowujemy przy
-- okazji: odobserwowanie jest sygnalem publicznym (znikam z czyjejs listy obserwujacych),
-- a to ma byc ciche zerwanie relacji prywatnej.
create or replace function public.remove_friend(p_other uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  delete from public.friendships
  where (requester_id = me and addressee_id = p_other)
     or (requester_id = p_other and addressee_id = me and status <> 'declined');
  get diagnostics n = row_count;
  return n > 0;
end; $$;

-- ── link zapraszajacy /dodaj/<kod> ─────────────────────────────────────────────
-- Link jest zgoda obu stron (jedna go wystawila, druga w niego weszla), wiec omija krok
-- akceptacji - ale od teraz zaklada takze obserwacje w obie strony, jak zwykla akceptacja.
create or replace function public.befriend_via_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); inviter uuid; ex record; recent int;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'guest_not_allowed');
  end if;
  select count(*) into recent from public.fn_throttle
    where bucket = 'bef:' || me::text and created_at > now() - interval '24 hours';
  if recent >= 20 then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
  insert into public.fn_throttle (bucket) values ('bef:' || me::text);
  perform public.ensure_current_user_profile();
  select id into inviter from public.profiles where invite_code = p_code;
  if inviter is null then return jsonb_build_object('ok', false, 'reason', 'invalid_code'); end if;
  if inviter = me then return jsonb_build_object('ok', false, 'reason', 'self'); end if;

  select * into ex from public.friendships
    where (requester_id = me and addressee_id = inviter)
       or (requester_id = inviter and addressee_id = me) limit 1;

  perform public.friend_follow(me, inviter);
  perform public.friend_follow(inviter, me);

  if ex.id is not null then
    if ex.status <> 'accepted' then
      update public.friendships
        set status = 'accepted', accepted_at = now(), declined_at = null, source = 'invite_link'
        where id = ex.id;
      perform public.notify_friend(inviter, me, 'friend_accept');
      return jsonb_build_object('ok', true, 'inviter', inviter);
    end if;
    return jsonb_build_object('ok', true, 'inviter', inviter, 'already', true);
  end if;

  insert into public.friendships (requester_id, addressee_id, status, accepted_at, source)
  values (inviter, me, 'accepted', now(), 'invite_link');
  perform public.notify_friend(inviter, me, 'friend_accept');
  return jsonb_build_object('ok', true, 'inviter', inviter);
end; $$;

-- ── backfill: kazda para wzajemnie obserwujaca sie = znajomi ───────────────────
insert into public.friendships (requester_id, addressee_id, status, accepted_at, source)
select least(f1.follower_id, f1.following_id), greatest(f1.follower_id, f1.following_id),
       'accepted', now(), 'mutual_follow'
from public.followers f1
join public.followers f2
  on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
where f1.follower_id < f1.following_id
  and not exists (
    select 1 from public.friendships fr
    where (fr.requester_id = f1.follower_id and fr.addressee_id = f1.following_id)
       or (fr.requester_id = f1.following_id and fr.addressee_id = f1.follower_id))
  and exists (select 1 from public.profiles p where p.id = f1.follower_id)
  and exists (select 1 from public.profiles p where p.id = f1.following_id);

-- ── granty (regula z audytu: SECDEF dostaje EXECUTE dla PUBLIC z automatu) ──────
revoke execute on function public.friend_follow(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_friend(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.befriend_via_invite(text) from public, anon;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.friend_ids(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.befriend_via_invite(text) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.friend_ids(uuid) to authenticated;
