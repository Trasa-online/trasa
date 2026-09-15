import { supabase } from "@/integrations/supabase/client";

// Zapisane listy (bookmark cudzej listy) w DB (tabela saved_collections, migracja 20260826l).
// Zrodlo prawdy dla zakladki "Zapisane" na profilu + powiadomien "Nowe miejsce!" gdy autor doda
// miejsce (chip = current_item_count > seen_item_count). localStorage (trasa_saved_collections)
// zostaje jako SZYBKI cache "czy zapisane" na kartach feedu - DB dopisujemy obok (best-effort).

async function itemCountOf(collectionId: string): Promise<number> {
  const { count } = await (supabase as any).from("discovery_items")
    .select("id", { count: "exact", head: true }).eq("collection_id", collectionId);
  return count ?? 0;
}

// Zapis: seen_item_count = aktualna liczba miejsc (user wlasnie widzi cala liste -> zero "nowych").
export async function saveCollectionDb(userId: string, collectionId: string, itemCount?: number): Promise<void> {
  try {
    const count = itemCount ?? (await itemCountOf(collectionId));
    await (supabase as any).from("saved_collections")
      .upsert({ user_id: userId, collection_id: collectionId, seen_item_count: count }, { onConflict: "user_id,collection_id" });
  } catch (e) { console.error("[savedCollections] save:", e); }
}

export async function unsaveCollectionDb(userId: string, collectionId: string): Promise<void> {
  try {
    await (supabase as any).from("saved_collections").delete().eq("user_id", userId).eq("collection_id", collectionId);
  } catch (e) { console.error("[savedCollections] unsave:", e); }
}

// User obejrzal liste -> "widzial" wszystkie aktualne miejsca (kasuje chip). Update tylko gdy zapisana.
export async function markCollectionSeenDb(userId: string, collectionId: string, itemCount: number): Promise<void> {
  try {
    await (supabase as any).from("saved_collections")
      .update({ seen_item_count: itemCount }).eq("user_id", userId).eq("collection_id", collectionId);
  } catch (e) { console.error("[savedCollections] seen:", e); }
}

// Jednorazowa migracja localStorage -> DB (best-effort): stare zapisy (sprzed tabeli) trafiaja do DB
// z seen_item_count = aktualna liczba miejsc (zeby stare listy nie pokazywaly falszywego "Nowe miejsce!").
export async function migrateLocalSavedCollections(userId: string): Promise<void> {
  try {
    const ids = (JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]") as string[]).filter(Boolean);
    if (!ids.length) return;
    const { data: existing } = await (supabase as any).from("saved_collections").select("collection_id").eq("user_id", userId);
    const have = new Set((existing ?? []).map((r: any) => r.collection_id));
    const missing = ids.filter((id) => !have.has(id));
    if (!missing.length) return;
    const { data: its } = await (supabase as any).from("discovery_items").select("collection_id").in("collection_id", missing);
    const counts: Record<string, number> = {};
    for (const it of (its ?? []) as any[]) counts[it.collection_id] = (counts[it.collection_id] ?? 0) + 1;
    const rows = missing.map((collection_id) => ({ user_id: userId, collection_id, seen_item_count: counts[collection_id] ?? 0 }));
    await (supabase as any).from("saved_collections").upsert(rows, { onConflict: "user_id,collection_id" });
  } catch (e) { console.error("[savedCollections] migrate:", e); }
}
