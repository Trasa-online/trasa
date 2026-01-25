-- Restore the deleted pin for user nyszje's route "Framer x Katowice"
INSERT INTO pins (
  place_name,
  address,
  description,
  image_url,
  images,
  rating,
  pin_order,
  tags,
  latitude,
  longitude,
  is_transport,
  transport_type,
  transport_end,
  mentioned_users,
  name_translations,
  original_creator_id,
  route_id
) VALUES (
  'Międzynarodowy Port Lotniczy Katowice',
  'Wolności 90, 42-625 Pyrzowice, Polska',
  '…tak się złożyło, że kupiłam bilety dla mnie i męża zamiast do Katowic bezpośrednio, to na Port Lotniczy w Katowicach! No cóż 🤭',
  'https://chxphfcpehxshvijqtlf.supabase.co/storage/v1/object/public/route-images/6b2d4c42-0ef2-4abd-9b23-9a9baec2f1cf/pin-0-0-1737799685991.jpg',
  ARRAY['https://chxphfcpehxshvijqtlf.supabase.co/storage/v1/object/public/route-images/6b2d4c42-0ef2-4abd-9b23-9a9baec2f1cf/pin-0-0-1737799685991.jpg']::text[],
  5,
  0,
  ARRAY['Lotnisko', 'Start podróży']::text[],
  50.4743073,
  19.0799019,
  false,
  NULL,
  NULL,
  '{}'::uuid[],
  '{}'::jsonb,
  NULL,
  'c34814c3-7f9c-4a02-9833-736b0bb85eae'
);

-- Mark the backup as restored so it can't be restored again
UPDATE pins_backup 
SET can_restore = false 
WHERE id = '90488b28-cbff-42bc-8954-030ec8e2ff79';