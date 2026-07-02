-- Powiadomienia dla znajomych: zaproszenie (friend_request) i akceptacja (friend_accept).
-- 1) Nowe wartosci enuma notification_type.
-- 2) Funkcje friendships insertuja notyfikacje (in-app feed w NotificationsDrawer).
-- 3) Trigger push (pg_net -> send-push) analogiczny do group_invite.
--
-- Uwaga PG: ALTER TYPE ADD VALUE + uzycie wartosci w CIELE funkcji jest bezpieczne
-- (literal '...'::notification_type jest rozwiazywany w runtime, nie przy CREATE FUNCTION).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_request';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_accept';

-- ── send_friend_request: nowe zaproszenie -> friend_request; auto-akcept (byl rewers) -> friend_accept ──
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
      -- Zaakceptowalem istniejace zaproszenie od p_addressee -> powiadom go, ze jestescie znajomymi.
      INSERT INTO public.notifications (user_id, type, actor_id)
      VALUES (p_addressee, 'friend_accept'::public.notification_type, me);
      RETURN 'accepted';
    END IF;
    RETURN 'pending';
  END IF;
  INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (me, p_addressee, 'pending');
  -- Nowe zaproszenie -> powiadom adresata.
  INSERT INTO public.notifications (user_id, type, actor_id)
  VALUES (p_addressee, 'friend_request'::public.notification_type, me);
  RETURN 'requested';
END;
$$;

-- ── accept_friend_request: po akceptacji powiadom zapraszajacego (friend_accept) ──
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_requester uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.friendships SET status='accepted', accepted_at=now()
    WHERE requester_id = p_requester AND addressee_id = me AND status='pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO public.notifications (user_id, type, actor_id)
    VALUES (p_requester, 'friend_accept'::public.notification_type, me);
  END IF;
  RETURN n > 0;
END;
$$;

-- ── befriend_via_invite: auto-przyjazn z linku -> powiadom zapraszajacego o nowym znajomym ──
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
  -- Nowy znajomy dolaczyl przez link -> powiadom zapraszajacego.
  INSERT INTO public.notifications (user_id, type, actor_id)
  VALUES (inviter, 'friend_accept'::public.notification_type, me);
  RETURN jsonb_build_object('ok', true, 'inviter', inviter);
END;
$$;

-- ── Push (pg_net -> send-push) dla friend_request / friend_accept ──
CREATE OR REPLACE FUNCTION public.notify_friend_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_name TEXT;
  v_title      TEXT;
  v_body       TEXT;
  v_payload    TEXT;
BEGIN
  IF NEW.type NOT IN ('friend_request', 'friend_accept') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(first_name, username, 'Ktoś')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = NEW.actor_id;

  IF NEW.type = 'friend_request' THEN
    v_title := 'Nowe zaproszenie do znajomych 👋';
    v_body  := COALESCE(v_actor_name, 'Ktoś') || ' chce dodać Cię do znajomych';
  ELSE
    v_title := 'Masz nowego znajomego 🎉';
    v_body  := COALESCE(v_actor_name, 'Ktoś') || ' przyjął(a) Twoje zaproszenie';
  END IF;

  v_payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title',   v_title,
    'body',    v_body,
    'url',     '/moj-profil'
  )::text;

  PERFORM extensions.net.http_post(
    url     := 'https://chxphfcpehxshvijqtlf.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU"}'::jsonb,
    body    := v_payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_friend_push ON public.notifications;
CREATE TRIGGER trigger_friend_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friend_push();
