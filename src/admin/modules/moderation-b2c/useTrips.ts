import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveStored } from "@/components/PlacePhoto";

// ── Moderacja B2C: WYJAZDY (opublikowane trasy) ──────────────────────────────
export interface TripCol {
  id: string;
  title: string | null;
  city: string | null;
  user_id: string | null;
  status: string | null;
  hidden_by_admin: boolean;
  created_at: string | null;
  place_count: number;
  cover: string | null;
  author: string | null;
}

export function useTrips() {
  return useQuery<TripCol[]>({
    queryKey: ["b2c-trips"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("routes")
        .select("id, title, city, user_id, status, hidden_by_admin, created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const routes = (data ?? []) as any[];
      const ids = routes.map((r) => r.id);
      const counts: Record<string, number> = {};
      const covers: Record<string, string> = {};
      if (ids.length) {
        const { data: pins } = await (supabase as any)
          .from("pins").select("route_id, photo_url, image_url, images, user_photo_urls, pin_order")
          .in("route_id", ids).order("pin_order", { ascending: true });
        for (const p of pins ?? []) {
          counts[p.route_id] = (counts[p.route_id] ?? 0) + 1;
          if (!covers[p.route_id]) {
            const u = resolveStored((Array.isArray(p.images) && p.images[0]) || (Array.isArray(p.user_photo_urls) && p.user_photo_urls[0]) || p.photo_url || p.image_url);
            if (u) covers[p.route_id] = u;
          }
        }
      }
      const authors: Record<string, string | null> = {};
      const uids = [...new Set(routes.map((r) => r.user_id).filter(Boolean))];
      if (uids.length) {
        const { data: profs } = await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids);
        (profs ?? []).forEach((p: any) => { authors[p.id] = p.first_name || p.username || null; });
      }
      return routes.map((r) => ({
        ...r, place_count: counts[r.id] ?? 0, cover: covers[r.id] ?? null, author: authors[r.user_id] ?? null,
      }));
    },
  });
}

export function useToggleTripHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await (supabase as any).rpc("admin_set_route_hidden", { p_route_id: id, p_hidden: hidden });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["b2c-trips"] }),
  });
}

// Szczegoly wyjazdu do przegladu: miejsca ze zdjeciami + notki
// (pins.description = notka autora pinu + pin_ratings.note = notki uczestnikow).
export interface TripPlace {
  place_name: string;
  photos: string[];
  notes: { text: string; author: string | null }[];
}

export async function fetchTripDetail(routeId: string): Promise<TripPlace[]> {
  const [{ data: pins }, { data: ratings }] = await Promise.all([
    (supabase as any).from("pins").select("place_name, description, photo_url, image_url, images, user_photo_urls, pin_order").eq("route_id", routeId).order("pin_order", { ascending: true }),
    (supabase as any).from("pin_ratings").select("place_name, note, user_id").eq("route_id", routeId),
  ]);
  const uids = [...new Set((ratings ?? []).map((r: any) => r.user_id).filter(Boolean))];
  const authors: Record<string, string> = {};
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids);
    (profs ?? []).forEach((p: any) => { authors[p.id] = p.first_name || p.username || "użytkownik"; });
  }
  const notesByPlace: Record<string, { text: string; author: string | null }[]> = {};
  for (const r of ratings ?? []) {
    if (!r.note?.trim()) continue;
    const k = (r.place_name || "").toLowerCase();
    (notesByPlace[k] ??= []).push({ text: r.note.trim(), author: authors[r.user_id] ?? null });
  }
  return (pins ?? []).map((p: any) => {
    const photos = [
      ...(Array.isArray(p.images) ? p.images : []),
      ...(Array.isArray(p.user_photo_urls) ? p.user_photo_urls : []),
      p.photo_url, p.image_url,
    ].filter(Boolean).map((u: string) => resolveStored(u)).filter(Boolean) as string[];
    const notes = [...(notesByPlace[(p.place_name || "").toLowerCase()] ?? [])];
    if (p.description?.trim()) notes.unshift({ text: p.description.trim(), author: null });
    return { place_name: p.place_name, photos: [...new Set(photos)].slice(0, 6), notes };
  });
}
