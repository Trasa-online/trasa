import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";

// Wynik wyszukiwarki Google Places (proxy) - ksztalt zgodny z PlaceForList (bez opcjonalnych pol).
export interface PlaceSearchItem {
  place_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  photo_url: string | null;
  place_id: string | null;
  google_place_id: string | null;
  rating: number | null;
}

// Haversine (km) - opcjonalny filtr "w obrebie" (center + scopeKm).
const distKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// Wspoldzielona wyszukiwarka Google Places (textsearch przez proxy, debounce 350ms, >=2 znaki).
// Opcjonalny `center` + `scopeKm` zawezaja wyniki (trasa/miasto); bez nich - globalnie (np. listy
// multi-miasto). Zwraca top 6. Uzywane w [AddPlaceSheet] i [CreateFlowSheet].
export function usePlaceSearch(
  query: string,
  opts?: { city?: string | null; center?: { lat: number; lng: number } | null; scopeKm?: number; enabled?: boolean },
) {
  const city = opts?.city ?? null;
  const center = opts?.center ?? null;
  const scopeKm = opts?.scopeKm ?? 20;
  const enabled = opts?.enabled ?? true;
  const searchMode = query.trim().length >= 2;
  const [results, setResults] = useState<PlaceSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!enabled || !searchMode) { setResults([]); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("google-places-proxy", {
          body: { action: "textsearch", query: `${query} ${city ?? ""}`.trim() },
        });
        if (!alive) return;
        setBlocked(!!(data as any)?.quota_exceeded);
        const all = ((data as any)?.results ?? []) as any[];
        const scoped = center
          ? all.filter((r) => r.latitude == null || r.longitude == null || distKm(center, { lat: r.latitude, lng: r.longitude }) <= scopeKm)
          : all;
        setResults(scoped.slice(0, 6).map((r) => ({
          place_name: r.name, address: r.full_address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: categoryFromGoogleTypes(r.types), photo_url: null, place_id: null, google_place_id: null, rating: null,
        })));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchMode, city, center, scopeKm, enabled]);

  return { results, searching, blocked, searchMode };
}
