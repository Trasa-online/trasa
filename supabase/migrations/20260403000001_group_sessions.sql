-- Group matching sessions
CREATE TABLE IF NOT EXISTS public.group_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Members of a group session (creator + invitees)
CREATE TABLE IF NOT EXISTS public.group_session_members (
  session_id UUID REFERENCES public.group_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, user_id)
);

-- Per-member swipe reactions within a group session
CREATE TABLE IF NOT EXISTS public.group_session_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.group_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  place_name TEXT NOT NULL,
  place_id TEXT,
  photo_url TEXT,
  category TEXT,
  reaction TEXT NOT NULL CHECK (reaction IN ('liked', 'skipped', 'super_liked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, user_id, place_name)
);

-- RLS
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_session_reactions ENABLE ROW LEVEL SECURITY;

-- group_sessions: any authenticated user can read (needed to join by code)
CREATE POLICY "Auth users can read group sessions"
  ON public.group_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can create group sessions"
  ON public.group_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- group_session_members: any auth user can read (see who's in group)
CREATE POLICY "Auth users can read group members"
  ON public.group_session_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join sessions"
  ON public.group_session_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON public.group_session_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- group_session_reactions: only members of the session can read/write
CREATE POLICY "Session members can read reactions"
  ON public.group_session_reactions FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT session_id FROM public.group_session_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can insert own reactions"
  ON public.group_session_reactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    session_id IN (
      SELECT session_id FROM public.group_session_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can update own reactions"
  ON public.group_session_reactions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
