import { supabase } from "@/integrations/supabase/client";

// Publikacja wyjazdu = SWIADOME "Zakoncz wyjazd" (decyzja Nat 2026-08-24). JEDYNE miejsce, ktore
// zamienia robocza trase w WSPOMNIENIE. Ustawia:
//  - status='published'   -> profil (Wspomnienia), bramka eksploracji, baza zdjec miejsc
//                            (fetchPlaceUserPhotos pomija piny tras != 'published')
//  - is_shared=true       -> widoczne w eksploracji + dostep czlonkow trasy wspolnej
//  - trip_type='completed'-> opuszcza dashboard aktywnych (useActiveSoloTrips/ActiveTripsDashboard)
//  - plan_finalized=true  -> "zrecenzowano": widok pokazuje PODSUMOWANIE zamiast steppera
// Okladke (list_cover_url) domyka caller osobno (ensureListCover) - bramka eksploracji jej wymaga.
// Zapis/edycja/notki/zdjecia NIGDY nie wolaja tej funkcji - publikacja jest wylacznie jawna.
export async function publishTrip(routeIds: string[]): Promise<void> {
  const ids = routeIds.filter(Boolean);
  if (!ids.length) return;
  const { error } = await (supabase as any)
    .from("routes")
    .update({ status: "published", is_shared: true, trip_type: "completed", plan_finalized: true })
    .in("id", ids);
  if (error) throw error;
}
