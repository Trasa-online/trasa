-- ════════════════════════════════════════════════════════════════════════════
-- MODEL PRZYJACIOL (symetryczny). Patrz pamiec: project_friends_model.
-- Dwie sciezki: szukanie -> request+accept; link zaproszeniowy -> auto-przyjazn.
-- Wszystkie mutacje przez SECURITY DEFINER RPC; RLS read-only na wlasne relacje.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see own friendships" ON public.friendships;
CREATE POLICY "see own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
-- Brak polityk INSERT/UPDATE/DELETE => mutacje tylko przez RPC ponizej (SECURITY DEFINER).

-- ── invite_code na profilu: stabilny, niezgadywalny link zaproszeniowy ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_code text;
UPDATE public.profiles SET invite_code = substr(md5(gen_random_uuid()::text), 1, 12) WHERE invite_code IS NULL;
ALTER TABLE public.profiles ALTER COLUMN invite_code SET DEFAULT substr(md5(gen_random_uuid()::text), 1, 12);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_invite_code ON public.profiles(invite_code);

-- ════════════════════════════════════════════════════════════════════════════
-- RPC
-- ════════════════════════════════════════════════════════════════════════════

-- Czy dwoje userow to przyjaciele (accepted, dowolny kierunek). Uzywane przez RLS tresci.
CREATE OR REPLACE FUNCTION public.are_friends(u1 uuid, u2 uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = u1 AND addressee_id = u2) OR (requester_id = u2 AND addressee_id = u1))
  );
$$;

-- Wyslij zaproszenie. Jesli istnieje odwrotne pending -> akceptuj. Idempotentne.
-- Zwraca: 'requested' | 'accepted' | 'pending' | 'already_friends'.
CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); ex record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF me = p_addressee THEN RAISE EXCEPTION 'Cannot friend yourself'; END IF;
  PERFORM public.ensure_current_user_profile();
  SELECT * INTO ex FROM public.friendships
    WHERE (requester_id = me AND addressee_id = p_addressee)
       OR (requester_id = p_addressee AND addressee_id = me) LIMIT 1;
  IF ex.id IS NOT NULL THEN
    IF ex.status = 'accepted' THEN RETURN 'already_friends'; END IF;
    IF ex.requester_id = p_addressee THEN
      UPDATE public.friendships SET status='accepted', accepted_at=now() WHERE id = ex.id;
      RETURN 'accepted';
    END IF;
    RETURN 'pending';
  END IF;
  INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (me, p_addressee, 'pending');
  RETURN 'requested';
END;
$$;

-- Akceptuj zaproszenie od p_requester (ja = addressee).
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_requester uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.friendships SET status='accepted', accepted_at=now()
    WHERE requester_id = p_requester AND addressee_id = me AND status='pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

-- Usun znajomego / odrzuc / wycofaj zaproszenie (dowolny kierunek).
CREATE OR REPLACE FUNCTION public.remove_friend(p_other uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.friendships
    WHERE (requester_id = me AND addressee_id = p_other)
       OR (requester_id = p_other AND addressee_id = me);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

-- Auto-przyjazn z linku zaproszeniowego (invite_code zapraszajacego). Bez akceptacji.
CREATE OR REPLACE FUNCTION public.befriend_via_invite(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); inviter uuid; ex record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.ensure_current_user_profile();
  SELECT id INTO inviter FROM public.profiles WHERE invite_code = p_code;
  IF inviter IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code'); END IF;
  IF inviter = me THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  SELECT * INTO ex FROM public.friendships
    WHERE (requester_id = me AND addressee_id = inviter)
       OR (requester_id = inviter AND addressee_id = me) LIMIT 1;
  IF ex.id IS NOT NULL THEN
    IF ex.status <> 'accepted' THEN
      UPDATE public.friendships SET status='accepted', accepted_at=now() WHERE id = ex.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'inviter', inviter, 'already', true);
  END IF;
  INSERT INTO public.friendships (requester_id, addressee_id, status, accepted_at)
    VALUES (inviter, me, 'accepted', now());
  RETURN jsonb_build_object('ok', true, 'inviter', inviter);
END;
$$;

GRANT EXECUTE ON FUNCTION public.are_friends(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.befriend_via_invite(text) TO authenticated, anon;
