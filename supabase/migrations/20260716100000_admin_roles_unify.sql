-- FUNDAMENT admin.trasa.travel (1/3): ujednolicenie auth admina.
--
-- Dzis dostep admina jest hybrydowy: hardcoded maile w kodzie (admins.ts +
-- FROZEN BusinessDashboard) LUB wiersz w user_roles. RLS oparte na has_role
-- dziala TYLKO dla wpisow w user_roles -> hardcoded-admin-po-mailu bez wiersza
-- nie przechodzi przez czesc zapisow. Wpisujemy wszystkich adminow do
-- user_roles (rola bazowa 'admin'), zeby RLS/has_role dzialalo spojnie.

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN (
  'nat.maz98@gmail.com',
  'tomalab97@gmail.com',
  'maciej.meszynski123@gmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;
