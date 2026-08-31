-- Listy publiczne bez bramki moderacyjnej (decyzja Nat 2026-08-31).
-- Bylo: INSERT publicznej listy -> moderation_status='pending', czyli nowa polecajka czekala
-- na admina, zanim ktokolwiek ja zobaczyl. Jest: kazda lista od razu 'approved', a ukrywanie
-- jest REAKTYWNE - admin ma hidden_by_admin (twarde ukrycie) i moderation_status='rejected'.
-- Trasy publikuja sie od razu i tak - bez zmian.
create or replace function public.guard_discovery_moderation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
DECLARE is_admin boolean;
BEGIN
  is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
  IF is_admin THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- Bez kolejki moderacyjnej: publiczna i prywatna lista sa od razu widoczne.
    NEW.moderation_status := 'approved';
    NEW.hidden_by_admin   := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      -- Przelaczenie prywatnosci NIE zdejmuje decyzji admina o odrzuceniu listy.
      NEW.moderation_status := CASE WHEN OLD.moderation_status = 'rejected' THEN 'rejected' ELSE 'approved' END;
    ELSIF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
       OR NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
      RAISE EXCEPTION 'Brak uprawnien do zmiany statusu moderacji';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: listy czekajace w kolejce sa juz widoczne (trigger wylaczony na czas UPDATE,
-- bo jego galaz UPDATE blokuje zmiane statusu przez nie-admina).
alter table public.discovery_collections disable trigger trg_guard_discovery_moderation;
update public.discovery_collections set moderation_status = 'approved' where moderation_status = 'pending';
alter table public.discovery_collections enable trigger trg_guard_discovery_moderation;
