import { supabase } from "@/integrations/supabase/client";

// Zdjecia per-miejsce z AUTOREM (tabela pin_photos, migracja 20260826). Etap "w trakcie": kazdy
// uczestnik dodaje zdjecia do miejsca, przy kazdym awatar osoby ktora je dodala. Dziala solo i grupowo.

export interface PinPhoto {
  id: string;
  route_id: string;
  place_name: string;
  user_id: string | null;
  url: string;
  avatar_url: string | null;
  username: string | null;
}

const nkey = (s: string) => String(s ?? "").toLowerCase().trim();

// Wszystkie zdjecia miejsc trasy + profil autora (avatar/username).
export async function fetchPinPhotos(routeId: string): Promise<PinPhoto[]> {
  const { data, error } = await (supabase as any)
    .from("pin_photos").select("id, route_id, place_name, user_id, url, created_at")
    .eq("route_id", routeId).order("created_at", { ascending: true });
  if (error) { console.error("[pinPhotos] fetch:", error.message); return []; }
  const rows = (data ?? []) as any[];
  const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const byId = new Map<string, { avatar_url: string | null; username: string | null }>();
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, avatar_url, username").in("id", uids);
    for (const p of (profs ?? []) as any[]) byId.set(p.id, { avatar_url: p.avatar_url, username: p.username });
  }
  return rows.map((r) => ({
    id: r.id, route_id: r.route_id, place_name: r.place_name, user_id: r.user_id, url: r.url,
    avatar_url: r.user_id ? (byId.get(r.user_id)?.avatar_url ?? null) : null,
    username: r.user_id ? (byId.get(r.user_id)?.username ?? null) : null,
  }));
}

export async function addPinPhoto(routeId: string, placeName: string, userId: string, url: string): Promise<boolean> {
  const { error } = await (supabase as any).from("pin_photos").insert({ route_id: routeId, place_name: placeName, user_id: userId, url });
  if (error) { console.error("[pinPhotos] add:", error.message); return false; }
  return true;
}

export async function deletePinPhoto(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from("pin_photos").delete().eq("id", id);
  if (error) { console.error("[pinPhotos] delete:", error.message); return false; }
  return true;
}

export function photosByPlace(photos: PinPhoto[]): Map<string, PinPhoto[]> {
  const m = new Map<string, PinPhoto[]>();
  for (const p of photos) { const k = nkey(p.place_name); const a = m.get(k); if (a) a.push(p); else m.set(k, [p]); }
  return m;
}

export { nkey as pinPhotoKey };
