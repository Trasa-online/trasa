-- Wspoldzielony wyjazd = wspoltworzenie: uczestnik (czlonek sesji grupowej) moze dodawac,
-- usuwac i zmieniac kolejnosc MIEJSC (pins) trasy grupowej. Osobne polityki OBOK wlascicielskich
-- ("Users can ... pins for their routes") - nie zastepuja ich. Dotyczy tylko pinow trasy, ktora
-- nalezy do sesji grupowej, ktorej wolajacy jest czlonkiem. NIE dotyka samej trasy (routes:
-- nazwa/publikacja/usuniecie zostaja owner-only). pins nie maja user_id-do-podszycia (original_creator_id
-- to tylko atrybucja), wiec brak ryzyka jak w H1 (tam chodzilo o routes.user_id).
create policy "Group members can add pins to shared route" on public.pins
  for insert to authenticated
  with check (exists (
    select 1 from public.routes r
    where r.id = pins.route_id and r.group_session_id is not null
      and exists (select 1 from public.group_session_members m
                  where m.session_id = r.group_session_id and m.user_id = auth.uid())
  ));

create policy "Group members can update pins of shared route" on public.pins
  for update to authenticated
  using (exists (
    select 1 from public.routes r
    where r.id = pins.route_id and r.group_session_id is not null
      and exists (select 1 from public.group_session_members m
                  where m.session_id = r.group_session_id and m.user_id = auth.uid())
  ));

create policy "Group members can delete pins of shared route" on public.pins
  for delete to authenticated
  using (exists (
    select 1 from public.routes r
    where r.id = pins.route_id and r.group_session_id is not null
      and exists (select 1 from public.group_session_members m
                  where m.session_id = r.group_session_id and m.user_id = auth.uid())
  ));
