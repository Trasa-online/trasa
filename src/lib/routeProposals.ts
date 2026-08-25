import { supabase } from "@/integrations/supabase/client";

// Wspolna PULA PROPOZYCJI miejsc do wyjazdu (tabela route_proposals, migracja 20260825).
// Host tworzy wyjazd + swoje piny; zaproszeni uczestnicy dorzucaja propozycje tutaj (async);
// host promuje wybrane do trasy (pins). RLS: czlonek sesji grupowej / wlasciciel trasy.

export interface ProposalInput {
  place_name: string;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  place_id?: string | null;
  google_place_id?: string | null;
  description?: string | null;
}

export interface RouteProposal extends ProposalInput {
  id: string;
  route_id: string;
  proposed_by: string | null;
  created_at: string;
  proposer?: { id: string; username: string | null; avatar_url: string | null } | null;
}

// Dorzuc propozycje miejsca do puli. proposed_by = self (wymog RLS INSERT). Zwraca true przy sukcesie.
export async function addRouteProposal(routeId: string, userId: string, place: ProposalInput): Promise<boolean> {
  if (!place.place_name?.trim()) return false;
  const { error } = await (supabase as any).from("route_proposals").insert({
    route_id: routeId,
    proposed_by: userId,
    place_name: place.place_name.trim(),
    category: place.category ?? null,
    address: place.address ?? null,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    photo_url: place.photo_url ?? null,
    place_id: place.place_id ?? null,
    google_place_id: place.google_place_id ?? null,
    description: place.description ?? null,
  });
  if (error) { console.error("[routeProposals] add failed:", error.message); return false; }
  return true;
}

// Wszystkie propozycje wyjazdu (najstarsze pierwsze) + profil autora (username/avatar) dociagniety
// osobno (brak FK profiles w select). RLS ogranicza do czlonkow/wlasciciela.
export async function fetchRouteProposals(routeId: string): Promise<RouteProposal[]> {
  const { data, error } = await (supabase as any)
    .from("route_proposals").select("*").eq("route_id", routeId)
    .order("created_at", { ascending: true });
  if (error) { console.error("[routeProposals] fetch failed:", error.message); return []; }
  const rows = (data ?? []) as RouteProposal[];
  const ids = [...new Set(rows.map((r) => r.proposed_by).filter(Boolean))] as string[];
  if (ids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", ids);
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    for (const r of rows) r.proposer = r.proposed_by ? ((byId.get(r.proposed_by) as any) ?? null) : null;
  }
  return rows;
}

// Usun propozycje. RLS: autor wycofuje swoja LUB wlasciciel trasy odrzuca/po promocji.
export async function deleteRouteProposal(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from("route_proposals").delete().eq("id", id);
  if (error) { console.error("[routeProposals] delete failed:", error.message); return false; }
  return true;
}

const normPin = (s: string | null | undefined) => String(s ?? "").toLowerCase().trim();

// Promuj propozycje do trasy: dodaj JEDEN pin na koniec (nie rusza istniejacych pinow ani ich zdjec)
// + usun propozycje z puli. W praktyce owner-only (RLS: pin insert = owner/czlonek, delete proposal =
// owner/autor). Dedup: jesli miejsce juz jest w trasie -> tylko usun propozycje (bez duplikatu pinu).
export async function promoteProposalToPin(routeId: string, ownerId: string, prop: RouteProposal): Promise<boolean> {
  const { data: pins } = await (supabase as any).from("pins").select("place_id, place_name, pin_order").eq("route_id", routeId);
  const rowsPins = (pins ?? []) as { place_id: string | null; place_name: string | null; pin_order: number | null }[];
  const exists = rowsPins.some((p) => (prop.place_id && p.place_id === prop.place_id) || normPin(p.place_name) === normPin(prop.place_name));
  if (exists) { await deleteRouteProposal(prop.id); return true; }
  const nextOrder = rowsPins.reduce((mx, p) => Math.max(mx, (p.pin_order ?? 0)), -1) + 1;
  const { error: pinErr } = await (supabase as any).from("pins").insert({
    route_id: routeId,
    place_name: prop.place_name,
    address: prop.address ?? "",            // pins.address NOT NULL
    description: prop.description ?? null,
    category: prop.category || "other",
    latitude: prop.latitude ?? null,
    longitude: prop.longitude ?? null,
    place_id: prop.place_id ?? null,
    suggested_time: null,
    photo_url: prop.photo_url ?? null,
    pin_order: nextOrder,
    original_creator_id: ownerId,
  });
  if (pinErr) { console.error("[routeProposals] promote (pin insert) failed:", pinErr.message); return false; }
  await deleteRouteProposal(prop.id);
  return true;
}
