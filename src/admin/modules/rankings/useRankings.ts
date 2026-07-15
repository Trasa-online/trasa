import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendClientPush } from "@/lib/clientPush";

// ── UGC "Zestawienia" (discovery_collections kind='ranking') ────────────────
export interface RankingCol {
  id: string;
  title: string | null;
  city: string | null;
  user_id: string | null;
  is_public: boolean;
  hidden_by_admin: boolean;
  moderation_status: string;
  updated_at: string | null;
  item_count: number;
  author: string | null;
}

export function useRankings() {
  return useQuery<RankingCol[]>({
    queryKey: ["rankings"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, user_id, is_public, hidden_by_admin, moderation_status, updated_at")
        .eq("kind", "ranking")
        .not("user_id", "is", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const cols = (data ?? []) as any[];
      const ids = cols.map((c) => c.id);
      const counts: Record<string, number> = {};
      const authors: Record<string, string | null> = {};
      if (ids.length) {
        const { data: items } = await (supabase as any).from("discovery_items").select("collection_id").in("collection_id", ids);
        (items ?? []).forEach((it: any) => { counts[it.collection_id] = (counts[it.collection_id] ?? 0) + 1; });
        const uids = [...new Set(cols.map((c) => c.user_id).filter(Boolean))];
        if (uids.length) {
          const { data: profs } = await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids);
          (profs ?? []).forEach((p: any) => { authors[p.id] = p.first_name || p.username || null; });
        }
      }
      const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
      return cols
        .map((c: any) => ({ ...c, item_count: counts[c.id] ?? 0, author: authors[c.user_id] ?? null }))
        .sort((a: any, b: any) => rank(a.moderation_status) - rank(b.moderation_status));
    },
  });
}

export function useModerateRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ col, status, note }: { col: RankingCol; status: "approved" | "rejected"; note?: string }) => {
      const patch: any = { moderation_status: status };
      if (status === "rejected") patch.moderation_note = note?.trim() || null;
      const { error } = await (supabase as any).from("discovery_collections").update(patch).eq("id", col.id);
      if (error) throw error;
      // Powiadomienie autora (in-app przez trigger DB przy zmianie statusu + push). Best-effort.
      if (col.user_id) {
        const title = col.title || "Twoje zestawienie";
        await sendClientPush(
          status === "approved"
            ? { userId: col.user_id, title: "Zestawienie zaakceptowane 🎉", body: `„${title}" jest już widoczne dla innych`, url: "/eksploruj" }
            : { userId: col.user_id, title: "Zestawienie odrzucone", body: note?.trim() ? `Powód: ${note.trim()}` : `„${title}" nie przeszło moderacji`, url: "/moj-profil" },
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rankings"] }),
  });
}

export function useToggleHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await (supabase as any).from("discovery_collections").update({ hidden_by_admin: hidden }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rankings"] }),
  });
}

export async function fetchCollectionItems(collectionId: string) {
  const { data } = await (supabase as any)
    .from("discovery_items")
    .select("id, place_name, address, rating, place_id, order_index")
    .eq("collection_id", collectionId)
    .order("order_index", { ascending: true });
  return (data ?? []) as any[];
}

// ── Leady miejsc (discovery_items bez place_id -> do bazy places) ────────────
export interface Lead {
  key: string;
  place_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  google_place_id: string | null;
  category: string | null;
  photo_url: string | null;
  city: string | null;
  count: number;
  item_ids: string[];
}

export function useLeads() {
  return useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("discovery_items")
        .select("id, place_name, address, latitude, longitude, rating, google_place_id, category, photo_url, collection_id, discovery_collections(city)")
        .is("place_id", null);
      if (error) throw error;
      const map = new Map<string, Lead>();
      (data ?? []).forEach((it: any) => {
        const k = it.google_place_id || `${(it.place_name || "").toLowerCase()}|${(it.address || "").toLowerCase()}`;
        const ex = map.get(k);
        if (ex) {
          ex.count += 1;
          ex.item_ids.push(it.id);
          if (!ex.photo_url && it.photo_url) ex.photo_url = it.photo_url;
          if (ex.rating == null && it.rating != null) ex.rating = it.rating;
        } else {
          map.set(k, {
            key: k, place_name: it.place_name, address: it.address,
            latitude: it.latitude, longitude: it.longitude, rating: it.rating,
            google_place_id: it.google_place_id, category: it.category, photo_url: it.photo_url,
            city: it.discovery_collections?.city ?? null, count: 1, item_ids: [it.id],
          });
        }
      });
      return [...map.values()].sort((a, b) => b.count - a.count);
    },
  });
}

export function usePromoteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Lead) => {
      let placeId: string | null = null;
      let placeName = lead.place_name;
      let reused = false;

      // Dedup po google_place_id - reuzyj istniejace miejsce zamiast duplikatu.
      if (lead.google_place_id) {
        const { data: existing } = await (supabase as any)
          .from("places").select("id, place_name").eq("google_place_id", lead.google_place_id).maybeSingle();
        if (existing) { placeId = existing.id; placeName = existing.place_name; reused = true; }
      }

      if (!placeId) {
        const { data: place, error: placeErr } = await (supabase as any)
          .from("places")
          .insert({
            place_name: lead.place_name, city: lead.city || "Warszawa", category: lead.category || "restaurant",
            address: lead.address, latitude: lead.latitude, longitude: lead.longitude,
            rating: lead.rating, photo_url: lead.photo_url, google_place_id: lead.google_place_id, is_active: true,
          })
          .select("id, place_name").single();
        if (placeErr || !place) throw new Error(placeErr?.message ?? "Błąd tworzenia miejsca");
        placeId = place.id; placeName = place.place_name;
      }

      // Claimowalna (ownerless) wizytowka dla miejsca - tylko gdy jeszcze nie ma.
      // moderation_status='approved': to admin-created lead, NIE do kolejki moderacji.
      const { data: bp } = await (supabase as any).from("business_profiles").select("id").eq("place_id", placeId).maybeSingle();
      if (!bp) {
        await (supabase as any).from("business_profiles").insert({
          place_id: placeId, business_name: placeName, city: lead.city || "Warszawa",
          street: lead.address, cover_image_url: lead.photo_url,
          latitude: lead.latitude, longitude: lead.longitude,
          owner_user_id: null, is_active: true, is_draft: false, moderation_status: "approved",
        });
      }

      // Linkuj itemy leada do miejsca -> staja sie klikalne w zestawieniach.
      await (supabase as any).from("discovery_items").update({ place_id: placeId }).in("id", lead.item_ids);
      return { placeName, reused };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
