-- FUNDAMENT admin.trasa.travel (3/3): nadanie tierow + helper + audit log +
-- soft-delete. Uruchom PO migracji 2/3 (enum musi juz miec nowe wartosci).

-- ── Nadanie tierow ──────────────────────────────────────────────────────────
-- Nat + tomalab97 = super_admin; maciej = operator.
-- ZMIEN podzial jesli inny (kto ma byc operatorem) - to jedyne miejsce.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('nat.maz98@gmail.com', 'tomalab97@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'operator'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('maciej.meszynski123@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- ── Helper: czy super_admin ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.has_role(_uid, 'super_admin') $$;

-- ── Audit log operacji nieodwracalnych (append-only) ────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id     uuid NOT NULL REFERENCES auth.users(id),
  actor_email  text,                 -- denormalizacja: przetrwa usuniecie konta aktora
  action       text NOT NULL,        -- 'business.approve','account.soft_delete','email.send','role.grant'
  target_type  text NOT NULL,        -- 'business_profile','profile','waitlist',...
  target_id    text,                 -- text: pokrywa uuid i inne klucze
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- diff / powod / liczba adresatow bulk
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log (action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admini czytaja log. BRAK policy INSERT/UPDATE/DELETE dla authenticated ->
-- zapis wylacznie service-role (edge functions). Append-only wymuszony brakiem
-- UPDATE/DELETE dla kogokolwiek poza service-role.
DROP POLICY IF EXISTS "admins read audit log" ON public.admin_audit_log;
CREATE POLICY "admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Soft-delete kont ────────────────────────────────────────────────────────
-- auth.users to Supabase Auth (nie da sie dodac kolumny), wiec flaga po naszej
-- stronie na profiles. Realne zablokowanie logowania = ban w Auth przez edge
-- (auth.admin.updateUserById ban_duration). Zapytania produktowe filtruja
-- deleted_at IS NULL.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_reason text;
