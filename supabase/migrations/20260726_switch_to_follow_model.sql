-- Przejscie z symetrycznego modelu 'znajomi' (friendships, request+accept) na ASYMETRYCZNY
-- 'follow' (tabela followers, 1-klik, bez akceptacji) - zgodnie z Figma (source of truth).
-- Tabela followers juz istniala i byla gotowa (PK, anti-spoof WITH CHECK, trigger notify_on_follow).

-- 1) Nie gubimy istniejacych relacji: kazda ZAAKCEPTOWANA friendship -> WZAJEMNE follow (2 wiersze).
--    Wylaczamy trigger powiadomien na czas migracji (inaczej stare relacje wygeneruja spam "obserwuje Cie").
alter table public.followers disable trigger on_follower_created;

insert into public.followers (follower_id, following_id)
  select requester_id, addressee_id from public.friendships where status = 'accepted'
  on conflict (follower_id, following_id) do nothing;
insert into public.followers (follower_id, following_id)
  select addressee_id, requester_id from public.friendships where status = 'accepted'
  on conflict (follower_id, following_id) do nothing;

alter table public.followers enable trigger on_follower_created;

-- 2) Widocznosc wpisow "Bliscy znajomi" (share_friends) w modelu follow = WZAJEMNI obserwujacy
--    (oboje sie obserwuja). are_friends() jest uzywane w RLS tras - redefinicja ciala nie rusza polityk.
create or replace function public.are_friends(u1 uuid, u2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.followers where follower_id = u1 and following_id = u2)
     and exists (select 1 from public.followers where follower_id = u2 and following_id = u1);
$$;
