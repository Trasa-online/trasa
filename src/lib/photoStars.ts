import { supabase } from "@/integrations/supabase/client";

// WYROZNIENIE ZDJECIA W GALERII WYJAZDU (migracja 20260917d, decyzja Nat 2026-09-17).
//
// Gwiazdka jest BINARNA - jak "topka" przy miejscu - ale ogladajacy ma ich tylko TRZY na
// jeden wyjazd. Niedobor jest tu cala mechanika: bez niego gwiazdka bylaby drugim
// polubieniem. Serce zostaje bez limitu, bo znaczy co innego ("podoba mi sie"), a gwiazdka
// to wyroznienie dla autora ("to jest najlepsze z tego wyjazdu").
//
// ⛔ Limit egzekwuje BAZA (trigger `guard_photo_star`), a nie ten plik. Klient zna stan
// galerii, ktora ma otwarta - a user moze miec wyjazd otwarty na dwoch urzadzeniach.
// Tutejszy licznik sluzy wylacznie temu, zeby POKAZAC, ile zostalo, i nie wysylac zapytania
// skazanego na blad.

/** Ile gwiazdek ma ogladajacy na JEDEN wyjazd. ⚠️ Ta sama liczba stoi w migracji 20260917d
 *  (`if v_used >= 3`). Zmieniasz limit - zmien w obu miejscach. */
export const STAR_BUDGET = 3;

export interface PhotoStars {
  /** photo_ref -> ile osob wyroznilo */
  counts: Map<string, number>;
  /** photo_ref, ktore wyroznil ZALOGOWANY user */
  mine: Set<string>;
}

export const photoStarsKey = (routeId?: string | null, userId?: string | null) =>
  ["route-photo-stars", routeId, userId] as const;

export const emptyPhotoStars = (): PhotoStars => ({ counts: new Map(), mine: new Set() });

/** Wszystkie wyroznienia wyjazdu jednym zapytaniem. Odczyt jest publiczny, a wierszy jest
 *  z natury malo (3 na osobe), wiec liczymy po stronie klienta zamiast dokladac RPC. */
export async function fetchPhotoStars(routeId: string, userId?: string | null): Promise<PhotoStars> {
  const out = emptyPhotoStars();
  const { data, error } = await (supabase as any)
    .from("photo_stars").select("photo_ref, user_id").eq("route_id", routeId);
  if (error) { console.warn("[photoStars] fetch:", error.message); return out; }
  for (const row of ((data as any[]) ?? [])) {
    out.counts.set(row.photo_ref, (out.counts.get(row.photo_ref) ?? 0) + 1);
    if (userId && row.user_id === userId) out.mine.add(row.photo_ref);
  }
  return out;
}

export type StarResult = "added" | "removed" | "budget" | "not_allowed" | "error";

export async function togglePhotoStar(
  routeId: string, photoRef: string, userId: string, starred: boolean,
): Promise<StarResult> {
  if (starred) {
    const { error } = await (supabase as any)
      .from("photo_stars").delete()
      .eq("route_id", routeId).eq("photo_ref", photoRef).eq("user_id", userId);
    if (error) { console.warn("[photoStars] remove:", error.message); return "error"; }
    return "removed";
  }
  const { error } = await (supabase as any)
    .from("photo_stars").insert({ route_id: routeId, photo_ref: photoRef, user_id: userId });
  if (!error) return "added";
  // Straznik w bazie rzuca nazwanym bledem - rozrozniamy go, zeby powiedziec userowi,
  // CO sie stalo, zamiast pokazac "cos poszlo nie tak".
  const msg = String(error.message ?? "");
  if (msg.includes("star_budget")) return "budget";
  if (msg.includes("own_trip_star")) return "not_allowed";
  if (msg.includes("duplicate")) return "added";
  console.warn("[photoStars] add:", msg);
  return "error";
}
