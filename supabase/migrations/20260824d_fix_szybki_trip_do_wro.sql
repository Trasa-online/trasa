-- Fix danych (Nat 2026-08-24): "Szybki trip do Wro" (8 miejsc, 0 zdjec/notek, brak okladki)
-- pokazywala sie jako Wspomnienie, bo miala status='published' + trip_type='completed' +
-- plan_finalized=true (sygnatura finishEditing/"Zapisz trase"), mimo ze user jej nie zakonczyl.
-- Model: wspomnienie = status='published', ustawiane WYLACZNIE swiadomym "Zakoncz wyjazd".
-- Cofamy TYLKO ten jeden rekord do roboczej (decyzja Nat: nie batchujemy, nie ruszamy defaultu).
-- is_shared zostaje true dla tras grupowych (group_session_id != null) - czlonkowie czytaja route
-- przez polityke is_shared=true; bramka eksploracji i tak wymaga teraz status='published'.
UPDATE public.routes
SET status = 'draft',
    trip_type = 'planning',
    plan_finalized = false,
    is_shared = (group_session_id IS NOT NULL),
    updated_at = now()
WHERE id = '1fbd0599-22a6-4004-8de1-8e500b9158f5';
