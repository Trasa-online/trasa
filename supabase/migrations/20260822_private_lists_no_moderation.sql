-- Prywatne listy (is_public=false) NIE potrzebuja moderacji (2026-08-22). Dotad guard wymuszal
-- 'pending' na KAZDYM insercie non-admina, wiec prywatne "Do zobaczenia"/kuratorskie mialy pending
-- bez sensu. Teraz: pending TYLKO gdy is_public=true. Zmiana prywatnosci (toggle "Rodzaj listy"
-- na widoku listy) ustawia moderacje automatycznie (publiczna->pending, prywatna->approved).

CREATE OR REPLACE FUNCTION public.guard_discovery_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE is_admin boolean;
BEGIN
  is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
  IF is_admin THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- Publiczna -> moderacja (pending). Prywatna -> od razu approved (poza kolejka).
    NEW.moderation_status := CASE WHEN NEW.is_public THEN 'pending' ELSE 'approved' END;
    NEW.hidden_by_admin   := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      -- Zmiana prywatnosci ustawia moderacje automatycznie (dozwolone dla wlasciciela).
      NEW.moderation_status := CASE WHEN NEW.is_public THEN 'pending' ELSE 'approved' END;
    ELSIF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
       OR NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
      RAISE EXCEPTION 'Brak uprawnien do zmiany statusu moderacji';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill: istniejace prywatne listy z 'pending' -> 'approved' (trigger wylaczony na czas UPDATE).
ALTER TABLE public.discovery_collections DISABLE TRIGGER trg_guard_discovery_moderation;
UPDATE public.discovery_collections
  SET moderation_status = 'approved'
  WHERE is_public = false AND moderation_status = 'pending' AND kind = 'ranking';
ALTER TABLE public.discovery_collections ENABLE TRIGGER trg_guard_discovery_moderation;
