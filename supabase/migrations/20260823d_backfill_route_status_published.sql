-- Backfill pod nowa bramke eksploracji (status='published'). Trasy AKTUALNIE widoczne w eksploracji
-- (is_shared=true + list_cover_url) oznaczamy jako opublikowane, zeby NIE zniknely po deployu bramki
-- (DiscoveryFeed/Explore dodaja .eq('status','published')). Nowe trasy zostaja 'draft' do momentu
-- "Zapisz trase" (finishEditing -> status='published'). Roboczy grupowy draft z auto-okladka juz
-- wiecej nie przeciekaja do eksploracji (musza byc opublikowane).
UPDATE public.routes
SET status = 'published'
WHERE is_shared = true
  AND list_cover_url IS NOT NULL
  AND status IS DISTINCT FROM 'published';
