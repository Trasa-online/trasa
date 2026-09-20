// Limity liczby miejsc (decyzja Nat 2026-09-20). Egzekwuje je BAZA (triggery z migracji
// `20260920_place_limits`, blad `place_limit`); tu tylko stale + sprawdzenie PRZED wysylka,
// zeby user dostal czytelny komunikat zamiast "Nie udalo sie dodac miejsca".
// Zmieniasz liczbe - zmien tez `v_limit` w migracji.
import i18n from "@/i18n";
import { toast } from "sonner";

export const MAX_TRIP_PLACES = 100;
/** Tylko kolekcje kuratorskie (`visited`). Prywatna „Ogolne" (wishlista) limitu nie ma. */
export const MAX_COLLECTION_PLACES = 30;

export type PlaceLimitKind = "trip_places" | "collection_places";

const MAX: Record<PlaceLimitKind, number> = { trip_places: MAX_TRIP_PLACES, collection_places: MAX_COLLECTION_PLACES };

export function placeLimitToast(kind: PlaceLimitKind, current: number) {
  toast.error(i18n.t(`common:limits.${kind}`, { max: MAX[kind], left: Math.max(0, MAX[kind] - current) }));
}

/** true = wolno dodac `adding` miejsc do stanu `current`; false = pokazuje toast i blokuje. */
export function checkPlaceLimit(kind: PlaceLimitKind, current: number, adding: number): boolean {
  if (current + adding <= MAX[kind]) return true;
  placeLimitToast(kind, current);
  return false;
}

/** Blad z bazy (trigger) - `hint` niesie rodzaj limitu. */
export function isPlaceLimitError(e: unknown): PlaceLimitKind | null {
  const msg = String((e as any)?.message ?? e ?? "");
  if (!msg.includes("place_limit")) return null;
  const hint = String((e as any)?.hint ?? "");
  return hint === "collection_places" ? "collection_places" : "trip_places";
}
