// "Gdzie juz bylem" - odwiedziny miejsc oznaczane przez uzytkownika (2026-09-08).
//
// Odwiedziny naleza do OGLADAJACEGO, nie do listy: odhaczenie na cudzej zapisanej liscie
// nie moze zmieniac jej wszystkim. Klucz to `place_key` (ten sam, co w galerii miejsca),
// wiec jedno odhaczenie widac na KAZDEJ liscie zawierajacej to miejsce - bez tego user
// musialby odhaczac to samo miejsce osobno w kazdej liscie.

import { supabase } from "@/integrations/supabase/client";

export type VisitInput = { placeKey: string; placeName?: string | null; city?: string | null };

/** Ktore z podanych miejsc user ma juz odhaczone. Pusty zbior, gdy nie jest zalogowany. */
export async function fetchVisitedKeys(userId: string | null | undefined, keys: string[]): Promise<Set<string>> {
  if (!userId || keys.length === 0) return new Set();
  try {
    const { data, error } = await (supabase as any)
      .from("place_visits").select("place_key").eq("user_id", userId).in("place_key", keys);
    if (error) { console.warn("[placeVisits] fetch:", error.message); return new Set(); }
    return new Set(((data ?? []) as { place_key: string }[]).map((r) => r.place_key));
  } catch (e) {
    console.warn("[placeVisits] fetch exception:", e instanceof Error ? e.message : e);
    return new Set();
  }
}

/**
 * Przelacza odhaczenie. Zwraca stan PO zmianie, zeby ekran nie musial zgadywac.
 * Przy bledzie oddaje stan sprzed zmiany - wtedy podglad wraca na swoje miejsce.
 */
export async function toggleVisited(
  userId: string, visited: boolean, place: VisitInput,
): Promise<boolean> {
  try {
    if (visited) {
      const { error } = await (supabase as any)
        .from("place_visits").delete().eq("user_id", userId).eq("place_key", place.placeKey);
      if (error) throw new Error(error.message);
      return false;
    }
    const { error } = await (supabase as any).from("place_visits").insert({
      user_id: userId, place_key: place.placeKey,
      place_name: place.placeName ?? null, city: place.city ?? null, source: "manual",
    });
    // 23505 = juz odhaczone (np. dwa tapniecia pod rzad). To nie jest blad dla usera.
    if (error && (error as any).code !== "23505") throw new Error(error.message);
    return true;
  } catch (e) {
    console.warn("[placeVisits] toggle:", e instanceof Error ? e.message : e);
    return visited;
  }
}
