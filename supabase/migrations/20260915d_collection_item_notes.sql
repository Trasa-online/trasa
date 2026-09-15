-- NOTKI PER-UCZESTNIK W KOLEKCJI (prosba Nat 2026-09-15): "kazdy uczestnik widzi wszystkie notki".
--
-- Do tej pory kolekcja miala JEDNA notke na miejsce (`discovery_items.short_desc`) - bo do
-- wczoraj kolekcje byly owner-only i jedna notka wystarczala. Po wlaczeniu wspoltworzenia
-- (migracja 20260915c) wspoltworca nie mial gdzie napisac wlasnej: musialby nadpisac cudza.
--
-- Teraz jest lustro `pin_ratings` z wyjazdow: jeden wiersz na (kolekcja, user, miejsce).
-- Wzorzec 1:1 z [[project_multiuser_notes_photos]], tylko route_id -> collection_id.
--
-- ⚠️ `discovery_items.short_desc` ZOSTAJE i dalej trzyma notke WLASCICIELA. Nie kasujemy go,
-- bo czyta go „Od użytkowników" na wizytowce (`fetchPlaceNotes`) i caly mechanizm synchronizacji
-- notek z 2026-09-13. Spojnosc pilnuje `propagate_place_note`: zapis notki gdziekolwiek
-- rozchodzi sie teraz TAKZE na te tabele, a notka wlasciciela dalej laduje w `short_desc`.

CREATE TABLE IF NOT EXISTS public.discovery_item_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.discovery_collections(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  place_name    text NOT NULL,
  note          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Tozsamosc miejsca = ZNORMALIZOWANA nazwa, ta sama regula co w calym systemie notek
-- (`place_note_key` jest IMMUTABLE, wiec moze stac w indeksie unikalnym).
CREATE UNIQUE INDEX IF NOT EXISTS din_one_per_user_place
  ON public.discovery_item_notes (collection_id, user_id, public.place_note_key(place_name));
CREATE INDEX IF NOT EXISTS din_collection_idx ON public.discovery_item_notes (collection_id);

ALTER TABLE public.discovery_item_notes ENABLE ROW LEVEL SECURITY;

-- Kto w ogole widzi te kolekcje: publiczna i zaakceptowana, wlasciciel albo wspoltworca.
-- SECURITY DEFINER, bo polityka nie moze czytac tabel, ktore same maja RLS zalezne od tej samej
-- kolekcji (rekurencja).
CREATE OR REPLACE FUNCTION public.can_read_collection(p_collection_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.discovery_collections c
     WHERE c.id = p_collection_id
       AND c.deleted_at IS NULL
       AND (
         (c.is_public AND NOT COALESCE(c.hidden_by_admin, false) AND COALESCE(c.moderation_status,'approved') <> 'rejected')
         OR c.user_id = p_user_id
         OR public.is_collection_member(c.id, p_user_id)
       )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_collection(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_read_collection(uuid, uuid) TO authenticated, anon;

-- Czytaja WSZYSCY, ktorzy widza kolekcje - o to chodzi w "kazdy uczestnik widzi wszystkie notki".
DROP POLICY IF EXISTS din_read ON public.discovery_item_notes;
CREATE POLICY din_read ON public.discovery_item_notes FOR SELECT
  USING (public.can_read_collection(collection_id, auth.uid()));

-- Pisze kazdy WSPOLTWORCA, ale wylacznie SWOJ wiersz. Cudzej notki nie da sie ani podmienic,
-- ani skasowac - tak samo jak przy pozycjach kolekcji.
DROP POLICY IF EXISTS din_own_insert ON public.discovery_item_notes;
CREATE POLICY din_own_insert ON public.discovery_item_notes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND user_id = auth.uid()
    AND (public.is_collection_owner(collection_id, auth.uid()) OR public.is_collection_member(collection_id, auth.uid()))
  );

DROP POLICY IF EXISTS din_own_update ON public.discovery_item_notes;
CREATE POLICY din_own_update ON public.discovery_item_notes FOR UPDATE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS din_own_delete ON public.discovery_item_notes;
CREATE POLICY din_own_delete ON public.discovery_item_notes FOR DELETE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Admin (panel ops) widzi wszystko - tak jak przy pozostalych tresciach UGC.
DROP POLICY IF EXISTS din_admin_all ON public.discovery_item_notes;
CREATE POLICY din_admin_all ON public.discovery_item_notes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role));

-- ── Backfill: istniejace `short_desc` to notki WLASCICIELA kolekcji ─────────────────────
INSERT INTO public.discovery_item_notes (collection_id, user_id, place_name, note)
SELECT DISTINCT ON (di.collection_id, c.user_id, public.place_note_key(di.place_name))
       di.collection_id, c.user_id, di.place_name, di.short_desc
  FROM public.discovery_items di
  JOIN public.discovery_collections c ON c.id = di.collection_id
 WHERE NULLIF(TRIM(COALESCE(di.short_desc, '')), '') IS NOT NULL
   AND c.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── Synchronizacja: notka napisana gdziekolwiek trafia takze tutaj ──────────────────────
-- Dopisujemy JEDEN blok do istniejacej funkcji: kolekcje, w ktorych user jest wlascicielem
-- ALBO wspoltworca, i ktore maja to miejsce. Reszta ciala bez zmian.
CREATE OR REPLACE FUNCTION public.propagate_place_note(p_user uuid, p_name text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_key  text := public.place_note_key(p_name);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_user is null or v_key = '' then return; end if;
  perform set_config('trasa.note_sync', '1', true);

  update public.discovery_items di
     set short_desc = v_note
    from public.discovery_collections c
   where c.id = di.collection_id
     and c.user_id = p_user
     and public.place_note_key(di.place_name) = v_key
     and di.short_desc is distinct from v_note;

  update public.pin_ratings pr
     set note = v_note
   where pr.user_id = p_user
     and public.place_note_key(pr.place_name) = v_key
     and pr.note is distinct from v_note;

  -- Wyjazdy USERA z tym miejscem, w ktorych nie ma jeszcze jego wiersza notki.
  if v_note is not null then
    insert into public.pin_ratings (route_id, user_id, place_name, note)
    select distinct on (p.route_id, public.place_note_key(p.place_name)) p.route_id, p_user, p.place_name, v_note
      from public.pins p
      join public.routes r on r.id = p.route_id
     where r.user_id = p_user
       and public.place_note_key(p.place_name) = v_key
       and not exists (
         select 1 from public.pin_ratings x
          where x.route_id = p.route_id and x.user_id = p_user
            and public.place_note_key(x.place_name) = v_key)
    on conflict (route_id, user_id, place_name) do update set note = excluded.note;
  end if;

  -- NOWE (2026-09-15): notki per-uczestnik w kolekcjach. Dotyczy kolekcji, w ktorych user
  -- jest wlascicielem ALBO wspoltworca i ktore zawieraja to miejsce.
  update public.discovery_item_notes din
     set note = coalesce(v_note, ''), updated_at = now()
   where din.user_id = p_user
     and public.place_note_key(din.place_name) = v_key
     and din.note is distinct from coalesce(v_note, '');

  if v_note is not null then
    insert into public.discovery_item_notes (collection_id, user_id, place_name, note)
    select distinct on (di.collection_id, public.place_note_key(di.place_name))
           di.collection_id, p_user, di.place_name, v_note
      from public.discovery_items di
      join public.discovery_collections c on c.id = di.collection_id
     where c.deleted_at is null
       and (c.user_id = p_user or public.is_collection_member(c.id, p_user))
       and public.place_note_key(di.place_name) = v_key
    on conflict (collection_id, user_id, public.place_note_key(place_name))
      do update set note = excluded.note, updated_at = now();
  end if;

  perform set_config('trasa.note_sync', '', true);
end; $function$;

-- Notka zapisana wprost w kolekcji rozchodzi sie dalej (wyjazdy, inne kolekcje usera) -
-- lustro `pin_rating_note_propagate`.
CREATE OR REPLACE FUNCTION public.discovery_item_note_propagate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if coalesce(current_setting('trasa.note_sync', true), '') = '1' then return new; end if;
  if tg_op = 'UPDATE' and new.note is not distinct from old.note then return new; end if;
  if tg_op = 'INSERT' and nullif(trim(coalesce(new.note, '')), '') is null then return new; end if;
  perform public.propagate_place_note(new.user_id, new.place_name, new.note);
  return new;
end; $function$;

DROP TRIGGER IF EXISTS trg_discovery_item_note_propagate ON public.discovery_item_notes;
CREATE TRIGGER trg_discovery_item_note_propagate
AFTER INSERT OR UPDATE OF note ON public.discovery_item_notes
FOR EACH ROW EXECUTE FUNCTION public.discovery_item_note_propagate();

-- Nowa pozycja w kolekcji dostaje notki tych wspoltworcow, ktorzy juz maja notke o tym
-- miejscu gdzie indziej - tak samo, jak `list_item_note_prefill` robi to dla wlasciciela.
CREATE OR REPLACE FUNCTION public.discovery_item_notes_prefill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_key text := public.place_note_key(new.place_name);
begin
  if v_key = '' then return new; end if;
  perform set_config('trasa.note_sync', '1', true);
  insert into public.discovery_item_notes (collection_id, user_id, place_name, note)
  select distinct on (u.user_id) new.collection_id, u.user_id, new.place_name, u.note
    from (
      select pr.user_id, pr.note from public.pin_ratings pr
       where public.place_note_key(pr.place_name) = v_key and nullif(trim(coalesce(pr.note,'')),'') is not null
      union all
      select din.user_id, din.note from public.discovery_item_notes din
       where public.place_note_key(din.place_name) = v_key and nullif(trim(coalesce(din.note,'')),'') is not null
    ) u
   where u.user_id = (select c.user_id from public.discovery_collections c where c.id = new.collection_id)
      or public.is_collection_member(new.collection_id, u.user_id)
  on conflict (collection_id, user_id, public.place_note_key(place_name)) do nothing;
  perform set_config('trasa.note_sync', '', true);
  return new;
end; $function$;

DROP TRIGGER IF EXISTS trg_discovery_item_notes_prefill ON public.discovery_items;
CREATE TRIGGER trg_discovery_item_notes_prefill
AFTER INSERT ON public.discovery_items
FOR EACH ROW EXECUTE FUNCTION public.discovery_item_notes_prefill();
