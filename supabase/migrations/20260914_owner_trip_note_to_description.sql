-- Notka WLASCICIELA o calym wyjezdzie (route_member_covers.note) to w praktyce OPIS wyjazdu
-- (routes.review_narrative) - u gosci wyswietlala sie jako szary dymek z awatarem zamiast
-- czystego tekstu pod tytulem (zgloszenie Nat 2026-09-14, "Majowka 2025"). Wlasciciel od
-- 2026-09-09 edytuje w tym miejscu opis, wiec jego notka to relikt: przenosimy ja do opisu
-- (gdy opisu nie ma) i kasujemy, zeby nie dublowala sie pod spodem.
update public.routes r
   set review_narrative = m.note
  from public.route_member_covers m
 where m.route_id = r.id and m.user_id = r.user_id
   and coalesce(trim(m.note), '') <> ''
   and coalesce(trim(r.review_narrative), '') = '';

update public.route_member_covers m
   set note = null
  from public.routes r
 where r.id = m.route_id and m.user_id = r.user_id
   and coalesce(trim(m.note), '') <> '';
