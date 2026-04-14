-- Demo group sessions: fully anonymous, no auth required.

CREATE TABLE IF NOT EXISTS public.demo_sessions (
  code       TEXT PRIMARY KEY,
  city       TEXT NOT NULL,
  category   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_sessions_public" ON public.demo_sessions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.demo_reactions (
  session_code TEXT    NOT NULL,
  device_id    TEXT    NOT NULL,
  place_name   TEXT    NOT NULL,
  liked        BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (session_code, device_id, place_name)
);
ALTER TABLE public.demo_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_reactions_public" ON public.demo_reactions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Auto-cleanup: delete demo data older than 7 days (run via pg_cron or manual)
-- DELETE FROM public.demo_reactions WHERE created_at < now() - interval '7 days';
-- DELETE FROM public.demo_sessions   WHERE created_at < now() - interval '7 days';
