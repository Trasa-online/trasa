-- Moderacja B2C wyjazdow (trasy): flaga ukrycia przez admina + RPC do jej ustawiania.
-- App (feed eksploracji) powinien filtrowac hidden_by_admin=false (zadanie po stronie main).
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS hidden_by_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_set_route_hidden(p_route_id uuid, p_hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.routes SET hidden_by_admin = p_hidden WHERE id = p_route_id;
END; $func$;
GRANT EXECUTE ON FUNCTION public.admin_set_route_hidden(uuid, boolean) TO authenticated;
