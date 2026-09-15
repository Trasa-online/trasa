-- Soft-moderacja list publicznych: publiczna lista jest widoczna OD RAZU (post-moderacja),
-- a NIE dopiero po zatwierdzeniu przez admina. Admin przeglada kolejke 'pending' (codzienny
-- przeglad) i moze odrzucic (moderation_status='rejected') lub ukryc (hidden_by_admin=true) -
-- wtedy lista znika z publicznego widoku. Prywatne (is_public=false) bez zmian.
--
-- Zmiana: public_read pokazuje pending + approved (wszystko poza 'rejected' i hidden_by_admin).
-- Guard (guard_discovery_moderation) zostaje bez zmian: publiczny insert -> 'pending' (kolejka).
alter policy discovery_collections_public_read on public.discovery_collections
  using (is_public = true and hidden_by_admin = false and moderation_status <> 'rejected');
