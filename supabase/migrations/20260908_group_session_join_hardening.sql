-- Dolaczanie do wyjazdu grupowego: tylko przez zaproszenie hosta (2026-09-08, audyt M4)
--
-- Znalezione w audycie: kazdy zalogowany user, ktory zna UUID sesji, mogl wejsc do cudzego
-- wyjazdu grupowego na dwa niezalezne sposoby. Sesje sa dlugowieczne (expires_at = rok),
-- a czlonek widzi trase, czat, notki i zdjecia pozostalych uczestnikow.
--
--   1. funkcja join_group_session(uuid) - SECURITY DEFINER, ZERO sprawdzen: wstawiala
--      auth.uid() do dowolnej sesji. W kodzie aplikacji nie ma ani jednego wywolania
--      (zostala po starym parowaniu grupowym, usunietym 2026-08-06) - czyli martwy kod
--      z pelnym dostepem. Usuwamy zamiast latac.
--   2. polityka INSERT "Users can join sessions" - sprawdzala tylko "wstawiam SIEBIE",
--      nie "zostalem zaproszony". To samo przez PostgREST, bez funkcji.
--
-- Legalne sciezki zostaja nietkniete:
--   - host wstawia SAM SIEBIE przy zakladaniu sesji (src/lib/groupInvite.ts),
--   - host dodaje zaproszonych przez add_member_to_session (SECURITY DEFINER, host-only).
-- Czyli: jedyny, kto moze dopisac wiersz, to wlasciciel sesji.

drop function if exists public.join_group_session(uuid);

drop policy if exists "Users can join sessions" on public.group_session_members;
create policy "Host can add self to own session"
  on public.group_session_members for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.group_sessions gs
       where gs.id = group_session_members.session_id
         and gs.created_by = auth.uid()
    )
  );
