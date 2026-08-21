-- Fix regresji po soft-moderacji (20260824): increment_collection_saves liczyl zapisy tylko dla
-- list 'approved'. Po soft-moderacji publiczne listy sa 'pending' (widoczne od razu) - wiec zapis
-- listy pending nie zwiekszal saves_count ("zapisy nie dzialaja"). Teraz liczymy dla kazdej
-- widocznej publicznej listy (pending + approved, poza rejected) - spojne z RLS public_read.
create or replace function public.increment_collection_saves(p_collection_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.discovery_collections
     set saves_count = coalesce(saves_count, 0) + 1
   where id = p_collection_id and is_public = true and moderation_status <> 'rejected';
end;
$function$;
