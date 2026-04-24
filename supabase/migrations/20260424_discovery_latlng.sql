ALTER TABLE discovery_items
  ADD COLUMN latitude  DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION;

-- Gdańsk kawiarnie
UPDATE discovery_items SET latitude = 54.3516, longitude = 18.6465 WHERE collection_id = 'dc000001-0000-0000-0000-000000000001' AND order_index = 0;
UPDATE discovery_items SET latitude = 54.3510, longitude = 18.6458 WHERE collection_id = 'dc000001-0000-0000-0000-000000000001' AND order_index = 1;
UPDATE discovery_items SET latitude = 54.3524, longitude = 18.6471 WHERE collection_id = 'dc000001-0000-0000-0000-000000000001' AND order_index = 2;
UPDATE discovery_items SET latitude = 54.3509, longitude = 18.6451 WHERE collection_id = 'dc000001-0000-0000-0000-000000000001' AND order_index = 3;
UPDATE discovery_items SET latitude = 54.3530, longitude = 18.6483 WHERE collection_id = 'dc000001-0000-0000-0000-000000000001' AND order_index = 4;

-- Kraków restauracje
UPDATE discovery_items SET latitude = 50.0618, longitude = 19.9372 WHERE collection_id = 'dc000001-0000-0000-0000-000000000002' AND order_index = 0;
UPDATE discovery_items SET latitude = 50.0607, longitude = 19.9375 WHERE collection_id = 'dc000001-0000-0000-0000-000000000002' AND order_index = 1;
UPDATE discovery_items SET latitude = 50.0622, longitude = 19.9359 WHERE collection_id = 'dc000001-0000-0000-0000-000000000002' AND order_index = 2;
UPDATE discovery_items SET latitude = 50.0619, longitude = 19.9363 WHERE collection_id = 'dc000001-0000-0000-0000-000000000002' AND order_index = 3;
UPDATE discovery_items SET latitude = 50.0621, longitude = 19.9367 WHERE collection_id = 'dc000001-0000-0000-0000-000000000002' AND order_index = 4;

-- Warszawa widoki
UPDATE discovery_items SET latitude = 52.2317, longitude = 21.0057 WHERE collection_id = 'dc000001-0000-0000-0000-000000000003' AND order_index = 0;
UPDATE discovery_items SET latitude = 52.2313, longitude = 21.0049 WHERE collection_id = 'dc000001-0000-0000-0000-000000000003' AND order_index = 1;
UPDATE discovery_items SET latitude = 52.2422, longitude = 21.0279 WHERE collection_id = 'dc000001-0000-0000-0000-000000000003' AND order_index = 2;
UPDATE discovery_items SET latitude = 52.2284, longitude = 21.0138 WHERE collection_id = 'dc000001-0000-0000-0000-000000000003' AND order_index = 3;
UPDATE discovery_items SET latitude = 52.1991, longitude = 21.0324 WHERE collection_id = 'dc000001-0000-0000-0000-000000000003' AND order_index = 4;
