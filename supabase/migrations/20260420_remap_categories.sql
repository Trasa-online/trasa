-- Remapowanie starych wartości kategorii biznesowych na nowe 4 kategorie główne
UPDATE public.business_profiles
SET main_category = CASE main_category
  WHEN 'restaurant'    THEN 'food'
  WHEN 'cafe'          THEN 'food'
  WHEN 'bar'           THEN 'food'
  WHEN 'club'          THEN 'food'
  WHEN 'museum'        THEN 'culture'
  WHEN 'monument'      THEN 'culture'
  WHEN 'gallery'       THEN 'culture'
  WHEN 'experience'    THEN 'attractions'
  WHEN 'market'        THEN 'attractions'
  WHEN 'shopping'      THEN 'attractions'
  WHEN 'park'          THEN 'nature'
  WHEN 'viewpoint'     THEN 'nature'
  WHEN 'accommodation' THEN NULL
  ELSE main_category
END
WHERE main_category IN (
  'restaurant','cafe','bar','club',
  'museum','monument','gallery',
  'experience','market','shopping',
  'park','viewpoint','accommodation'
);
