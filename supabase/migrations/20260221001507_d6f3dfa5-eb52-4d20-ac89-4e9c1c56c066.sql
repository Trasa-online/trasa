
-- Create folder for Kraków trip
INSERT INTO route_folders (id, user_id, name, is_trip, num_days, folder_order)
VALUES ('a1b2c3d4-1111-2222-3333-444455556666', 'e8e691a5-e622-437a-add6-7974b9634c8b', 'Kraków', true, 2, 10);

-- Day 1 - yesterday
INSERT INTO routes (id, user_id, title, city, status, trip_type, folder_id, day_number, start_date, folder_order, priorities, pace)
VALUES ('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0001', 'e8e691a5-e622-437a-add6-7974b9634c8b', 'Kraków — Dzień 1', 'Kraków', 'draft', 'ongoing', 'a1b2c3d4-1111-2222-3333-444455556666', 1, '2026-02-20', 0, ARRAY['Kultura', 'Jedzenie', 'Spacer'], 'moderate');

-- Day 2 - today
INSERT INTO routes (id, user_id, title, city, status, trip_type, folder_id, day_number, start_date, folder_order, priorities, pace)
VALUES ('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0002', 'e8e691a5-e622-437a-add6-7974b9634c8b', 'Kraków — Dzień 2', 'Kraków', 'draft', 'ongoing', 'a1b2c3d4-1111-2222-3333-444455556666', 2, '2026-02-21', 1, ARRAY['Kultura', 'Jedzenie', 'Spacer'], 'moderate');

-- Pins for Day 1
INSERT INTO pins (route_id, place_name, address, pin_order, latitude, longitude, suggested_time, description, category) VALUES
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0001', 'Wawel', 'Wawel 5, 31-001 Kraków', 0, 50.05410, 19.93530, '10:00', 'Zamek Królewski i Katedra na wzgórzu nad Wisłą', 'landmark'),
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0001', 'Sukiennice', 'Rynek Główny 1/3, 31-042 Kraków', 1, 50.06170, 19.93730, '12:30', 'Historyczne targowisko w sercu Rynku Głównego', 'landmark'),
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0001', 'Restauracja Pod Baranem', 'ul. Św. Gertrudy 21, 31-049 Kraków', 2, 50.05650, 19.93880, '14:00', 'Tradycyjna kuchnia polska w klimatycznym wnętrzu', 'restaurant'),
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0001', 'Kazimierz', 'ul. Szeroka, 31-053 Kraków', 3, 50.05130, 19.94620, '16:00', 'Spacer po dawnej dzielnicy żydowskiej pełnej galerii i kawiarni', 'neighborhood');

-- Pins for Day 2
INSERT INTO pins (route_id, place_name, address, pin_order, latitude, longitude, suggested_time, description, category) VALUES
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0002', 'Fabryka Schindlera', 'ul. Lipowa 4, 30-702 Kraków', 0, 50.04740, 19.96150, '10:00', 'Muzeum poświęcone historii Krakowa podczas II wojny światowej', 'museum'),
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0002', 'Podgórze', 'Rynek Podgórski, 30-533 Kraków', 1, 50.04650, 19.95100, '12:30', 'Historyczna dzielnica z Placem Bohaterów Getta', 'neighborhood'),
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0002', 'Kładka Bernatka', 'Most Bernatka, Kraków', 2, 50.04920, 19.94790, '14:00', 'Pieszy most z rzeźbami łączący Kazimierz z Podgórzem', 'landmark'),
('a1b2c3d4-aaaa-bbbb-cccc-ddddeeee0002', 'Plac Nowy', 'Plac Nowy, 31-056 Kraków', 3, 50.05110, 19.94440, '15:30', 'Słynne zapiekanki i klimat krakowskiego street foodu', 'food');
