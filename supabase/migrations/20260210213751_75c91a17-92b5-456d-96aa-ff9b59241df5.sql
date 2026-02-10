-- Fix existing routes with duplicate folder_order=0 by assigning order based on created_at
WITH ordered_routes AS (
  SELECT id, folder_id, 
    ROW_NUMBER() OVER (PARTITION BY folder_id ORDER BY created_at ASC) - 1 AS new_order
  FROM public.routes
  WHERE folder_id IS NOT NULL
)
UPDATE public.routes r
SET folder_order = o.new_order
FROM ordered_routes o
WHERE r.id = o.id AND r.folder_order IS DISTINCT FROM o.new_order;