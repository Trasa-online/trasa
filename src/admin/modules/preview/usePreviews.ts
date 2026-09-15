// Dane do PODGLADOW "jak w apce": kolekcja, wyjazd, wizytowka lokalu.
//
// Po co osobne zapytania, skoro listy juz cos maja: listy ciagna minimum do wiersza
// (nazwa, licznik, sześć miniaturek). Podglad ma pokazac to, co widzi uzytkownik
// aplikacji - wszystkie miejsca, wszystkie zdjecia, notki i podzial na dni - wiec
// ladujemy go DOPIERO po otwarciu arkusza (`enabled: !!id`), nie przy kazdej liscie.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PreviewAuthor {
  user_id: string | null;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
}

export interface PreviewPlace {
  key: string;
  place_name: string;
  address: string | null;
  category: string | null;
  /** ORYGINALNE url-e z bazy - moderacja zdjecia dopasowuje po wartosci, nie po podpisanym linku. */
  photos: string[];
  notes: { text: string; author: string | null }[];
  isTop: boolean;
  dayIndex: number | null;
}

async function loadProfiles(ids: (string | null | undefined)[]): Promise<Record<string, PreviewAuthor>> {
  const uids = [...new Set(ids.filter(Boolean))] as string[];
  if (!uids.length) return {};
  const { data } = await (supabase as any).from("profiles").select("id, username, first_name, avatar_url").in("id", uids);
  return Object.fromEntries((data ?? []).map((p: any) => [p.id, {
    user_id: p.id, username: p.username ?? null, first_name: p.first_name ?? null, avatar_url: p.avatar_url ?? null,
  }]));
}

// ── KOLEKCJA ─────────────────────────────────────────────────────────────────
export interface CollectionPreviewData {
  id: string;
  title: string | null;
  city: string | null;
  countries: string[] | null;
  theme: string | null;
  isPublic: boolean;
  moderationStatus: string;
  hidden: boolean;
  author: PreviewAuthor | null;
  places: PreviewPlace[];
}

export function useCollectionPreview(id: string | null) {
  return useQuery<CollectionPreviewData>({
    queryKey: ["preview-collection", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: col, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, countries, theme, is_public, hidden_by_admin, moderation_status, user_id")
        .eq("id", id).single();
      if (error) throw error;

      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, place_name, address, category, photo_url, short_desc, order_index, is_top")
        .eq("collection_id", id)
        .order("order_index", { ascending: true });

      const profiles = await loadProfiles([col.user_id]);

      return {
        id: col.id,
        title: col.title ?? null,
        city: col.city ?? null,
        countries: col.countries ?? null,
        theme: col.theme ?? null,
        isPublic: col.is_public !== false,
        moderationStatus: col.moderation_status ?? "pending",
        hidden: !!col.hidden_by_admin,
        author: profiles[col.user_id] ?? null,
        places: (items ?? []).map((it: any) => ({
          key: it.id,
          place_name: it.place_name,
          address: it.address ?? null,
          category: it.category ?? null,
          photos: it.photo_url ? [it.photo_url] : [],
          notes: it.short_desc?.trim() ? [{ text: it.short_desc.trim(), author: null }] : [],
          isTop: !!it.is_top,
          dayIndex: null,
        })),
      };
    },
  });
}

// ── WYJAZD ───────────────────────────────────────────────────────────────────
export interface TripPreviewData {
  id: string;
  title: string | null;
  city: string | null;
  countries: string[] | null;
  startDate: string | null;
  endDate: string | null;
  /** Opis wyjazdu = routes.review_narrative (glos wlasciciela). */
  description: string | null;
  coverUrl: string | null;
  hidden: boolean;
  author: PreviewAuthor | null;
  /** Notki POZOSTALYCH uczestnikow o calym wyjezdzie (route_member_covers.note). */
  memberNotes: { text: string; author: string | null }[];
  places: PreviewPlace[];
  /** Czy wyjazd ma podzial na dni - jesli nie, renderujemy jedna liste. */
  hasDays: boolean;
}

export function useTripPreview(id: string | null) {
  return useQuery<TripPreviewData>({
    queryKey: ["preview-trip", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: route, error } = await (supabase as any)
        .from("routes")
        .select("id, title, city, countries, user_id, start_date, end_date, review_narrative, list_cover_url, hidden_by_admin")
        .eq("id", id).single();
      if (error) throw error;

      const [{ data: pins }, { data: ratings }, { data: covers }] = await Promise.all([
        (supabase as any).from("pins")
          .select("id, place_name, address, category, description, photo_url, image_url, images, user_photo_urls, pin_order, day_index, is_top")
          .eq("route_id", id).order("pin_order", { ascending: true }),
        (supabase as any).from("pin_ratings").select("place_name, note, user_id").eq("route_id", id),
        (supabase as any).from("route_member_covers").select("user_id, note").eq("route_id", id).not("note", "is", null),
      ]);

      const profiles = await loadProfiles([
        route.user_id,
        ...(ratings ?? []).map((r: any) => r.user_id),
        ...(covers ?? []).map((c: any) => c.user_id),
      ]);
      const who = (uid: string | null) => {
        const p = uid ? profiles[uid] : null;
        return p ? (p.first_name || p.username || "użytkownik") : null;
      };

      // Notka o MIEJSCU jest jedna na osobe (patrz CLAUDE.md, propagate_place_note),
      // wiec grupujemy po znormalizowanej nazwie - tak samo jak robi to aplikacja.
      const notesByPlace: Record<string, { text: string; author: string | null }[]> = {};
      for (const r of ratings ?? []) {
        if (!r.note?.trim()) continue;
        const k = String(r.place_name ?? "").toLowerCase().trim();
        (notesByPlace[k] ??= []).push({ text: r.note.trim(), author: who(r.user_id) });
      }

      const places: PreviewPlace[] = (pins ?? []).map((p: any) => {
        const photos = [
          ...(Array.isArray(p.images) ? p.images : []),
          ...(Array.isArray(p.user_photo_urls) ? p.user_photo_urls : []),
          p.photo_url, p.image_url,
        ].filter(Boolean) as string[];
        const notes = [...(notesByPlace[String(p.place_name ?? "").toLowerCase().trim()] ?? [])];
        if (p.description?.trim()) notes.unshift({ text: p.description.trim(), author: null });
        return {
          key: p.id,
          place_name: p.place_name,
          address: p.address || null,
          category: p.category ?? null,
          photos: [...new Set(photos)],
          notes,
          isTop: !!p.is_top,
          dayIndex: p.day_index ?? null,
        };
      });

      // Notka WLASCICIELA w route_member_covers to ten sam glos co opis wyjazdu
      // (migracja 20260914_owner_trip_note_to_description) - nie dublujemy jej pod spodem.
      const memberNotes = (covers ?? [])
        .filter((c: any) => c.user_id !== route.user_id && c.note?.trim())
        .map((c: any) => ({ text: c.note.trim(), author: who(c.user_id) }));

      return {
        id: route.id,
        title: route.title ?? null,
        city: route.city ?? null,
        countries: route.countries ?? null,
        startDate: route.start_date ?? null,
        endDate: route.end_date ?? null,
        description: route.review_narrative ?? null,
        coverUrl: route.list_cover_url ?? null,
        hidden: !!route.hidden_by_admin,
        author: profiles[route.user_id] ?? null,
        memberNotes,
        places,
        hasDays: places.some((p) => p.dayIndex != null),
      };
    },
  });
}

// ── WIZYTOWKA LOKALU ─────────────────────────────────────────────────────────
export interface BusinessPreviewData {
  id: string;
  business_name: string | null;
  main_category: string | null;
  subcategories: string[] | null;
  tags: string[] | null;
  city: string | null;
  street: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  cover_image_url: string | null;
  cover_video_url: string | null;
  logo_url: string | null;
  gallery_urls: string[] | null;
  opening_hours: any | null;
  is_active: boolean;
  moderation_status: string;
  owner_user_id: string | null;
  place_id: string | null;
  created_at: string;
  owner: PreviewAuthor | null;
}

export function useBusinessPreview(id: string | null) {
  return useQuery<BusinessPreviewData>({
    queryKey: ["preview-business", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("business_profiles")
        .select(
          "id, business_name, main_category, subcategories, tags, city, street, address, phone, email, website, " +
          "description, cover_image_url, cover_video_url, logo_url, gallery_urls, opening_hours, is_active, " +
          "moderation_status, owner_user_id, place_id, created_at",
        )
        .eq("id", id).single();
      if (error) throw error;
      const profiles = await loadProfiles([data.owner_user_id]);
      return { ...data, owner: profiles[data.owner_user_id] ?? null } as BusinessPreviewData;
    },
  });
}
