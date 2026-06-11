-- Udostepniona trasa (/route/:id) inkrementuje licznik wyswietlen tez dla
-- niezalogowanych odwiedzajacych (web link). Funkcja jest SECURITY DEFINER.
GRANT EXECUTE ON FUNCTION public.increment_route_views(uuid) TO anon;
