-- Fix: brak DELETE policy na group_session_members.
-- RLS enabled + brak policy = wszystkie DELETE blokowane silently.
-- User-reported: 'Nie moge opuscic grupowej trasy, wraca mi caly czas na widoku dziennika'.
-- Bo JournalTab.handleDelete robi .from(group_session_members).delete().eq(user_id, ...)
-- co zwraca success bez error ale 0 rows zmienionych (RLS blokuje).
--
-- Policy: user moze DELETE tylko swoja wlasna membership (user_id = auth.uid()).
-- Session creator moze tez DELETE czlonkow (do moderacji).

drop policy if exists "Users can leave sessions" on public.group_session_members;
create policy "Users can leave sessions"
  on public.group_session_members for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Session creator can remove members" on public.group_session_members;
create policy "Session creator can remove members"
  on public.group_session_members for delete to authenticated
  using (
    exists (
      select 1 from public.group_sessions gs
      where gs.id = group_session_members.session_id
        and gs.created_by = auth.uid()
    )
  );
