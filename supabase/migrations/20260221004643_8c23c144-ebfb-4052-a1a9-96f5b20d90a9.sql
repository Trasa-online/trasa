
-- Delete all related data for routes not owned by nyszje
-- Order matters due to foreign keys

-- Delete route_notes for these routes' pins
DELETE FROM public.route_notes WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete day_considerations
DELETE FROM public.day_considerations WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete day_deviations
DELETE FROM public.day_deviations WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete chat_sessions
DELETE FROM public.chat_sessions WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete comments
DELETE FROM public.comments WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete likes
DELETE FROM public.likes WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete saved_routes
DELETE FROM public.saved_routes WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete route_completions
DELETE FROM public.route_completions WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete notifications
DELETE FROM public.notifications WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete pin_visits for pins of these routes
DELETE FROM public.pin_visits WHERE pin_id IN (SELECT id FROM pins WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b'));

-- Delete pin_comments for pins of these routes
DELETE FROM public.pin_comments WHERE pin_id IN (SELECT id FROM pins WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b'));

-- Delete pins (this will trigger backup)
DELETE FROM public.pins WHERE route_id IN (SELECT id FROM routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b');

-- Delete routes
DELETE FROM public.routes WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b';

-- Also clean up folders for non-nyszje users
DELETE FROM public.route_folders WHERE user_id != 'e8e691a5-e622-437a-add6-7974b9634c8b';
