-- Lista "Ogólne" DOSTĘPNA OD ZAŁOŻENIA KONTA (decyzja Nat 2026-08-24). Trigger na profiles INSERT
-- tworzy prywatną, niemoderowaną listę "Ogólne" dla każdego nowego usera + backfill istniejących.
-- Best-effort (EXCEPTION -> NULL): nigdy nie blokuje tworzenia profilu. Idempotentne (NOT EXISTS).
CREATE OR REPLACE FUNCTION public.create_general_list() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.discovery_collections
    (user_id, title, city, kind, list_status, is_public, moderation_status, author_name, author_avatar)
  SELECT NEW.id, 'Ogólne', NULL, 'ranking', 'to_visit', false, 'approved',
         COALESCE(NEW.first_name, NEW.username, 'Użytkownik'), NEW.avatar_url
  WHERE NOT EXISTS (
    SELECT 1 FROM public.discovery_collections c
    WHERE c.user_id = NEW.id AND c.kind = 'ranking' AND c.list_status = 'to_visit'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_create_general_list ON public.profiles;
CREATE TRIGGER trg_create_general_list AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_general_list();

-- Backfill: istniejący userzy bez listy "Ogólne" (to_visit) dostają pustą.
INSERT INTO public.discovery_collections
  (user_id, title, city, kind, list_status, is_public, moderation_status, author_name, author_avatar)
SELECT p.id, 'Ogólne', NULL, 'ranking', 'to_visit', false, 'approved',
       COALESCE(p.first_name, p.username, 'Użytkownik'), p.avatar_url
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.discovery_collections c
  WHERE c.user_id = p.id AND c.kind = 'ranking' AND c.list_status = 'to_visit'
);
