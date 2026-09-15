import { supabase } from "@/integrations/supabase/client";

// WSPOLTWORZENIE KOLEKCJI (prosba Nat 2026-09-15). Lustro `groupInvite.ts` z wyjazdow,
// tylko bez sesji grupowej: kolekcja nie potrzebuje osobnego bytu, wiec czlonkostwo wisi
// wprost na niej (`discovery_collection_members`, migracja 20260915c).
//
// Dwa RPC per osoba, oba SECURITY DEFINER i oba sprawdzaja, ze wolajacy jest WLASCICIELEM:
//  - `add_member_to_collection` - dopisuje czlonka i laduje kolekcje w jego "Zapisane",
//    zeby pojawila sie u niego bez szukania,
//  - `notify_collection_invite` - powiadomienie in-app + push (typ `list_invite`), bo klient
//    nie ma INSERT na `notifications`.
//
// ⛔ Prywatna "Ogolne" (`list_status = to_visit`) nie podlega wspoltworzeniu - RPC ja odrzuca.

export interface CollectionMember {
  user_id: string;
  role: string;
  created_at: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
  avatar_frame: string | null;
  avatar_frame_color: string | null;
}

export const collectionMembersKey = (collectionId: string | null | undefined) =>
  ["collection-members", collectionId ?? null] as const;

/** Zaproszeni wspoltworcy + ich profile (awatar i nick do wiersza osoby). */
export async function fetchCollectionMembers(collectionId: string): Promise<CollectionMember[]> {
  const { data, error } = await (supabase as any)
    .from("discovery_collection_members")
    .select("user_id, role, created_at")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: true });
  if (error) { console.warn("[collectionInvite] members:", error.message); return []; }
  const rows = (data ?? []) as { user_id: string; role: string; created_at: string }[];
  if (!rows.length) return [];
  const { data: profs } = await (supabase as any)
    .from("profiles")
    .select("id, username, first_name, avatar_url, avatar_frame, avatar_frame_color")
    .in("id", rows.map((r) => r.user_id));
  const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => {
    const p: any = byId.get(r.user_id) ?? {};
    return {
      user_id: r.user_id, role: r.role, created_at: r.created_at,
      username: p.username ?? null, first_name: p.first_name ?? null, avatar_url: p.avatar_url ?? null,
      avatar_frame: p.avatar_frame ?? null, avatar_frame_color: p.avatar_frame_color ?? null,
    };
  });
}

/** Zwraca liczbe faktycznie dodanych osob (juz dodane i sam autor sa pomijane). */
export async function inviteUsersToCollection(
  collectionId: string,
  inviteeIds: string[],
  ownerUserId: string,
): Promise<{ ok: boolean; added: number; error?: string }> {
  const ids = Array.from(new Set(inviteeIds.filter((id) => id && id !== ownerUserId)));
  if (!ids.length) return { ok: true, added: 0 };
  try {
    // Ten sam bezpiecznik co przy wyjazdach: zaproszony moze nie miec jeszcze wiersza profilu.
    await (supabase as any).rpc("ensure_current_user_profile");
    let added = 0;
    for (const uid of ids) {
      const { data, error } = await (supabase as any).rpc("add_member_to_collection", { p_collection_id: collectionId, p_user_id: uid });
      if (error) { console.warn("[collectionInvite] add_member:", error.message); continue; }
      if (data === true) added += 1;
      // Powiadomienie wysylamy TAKZE przy powtorzonym dodaniu - RPC samo dedupuje po (osoba, kolekcja).
      await (supabase as any).rpc("notify_collection_invite", { p_collection_id: collectionId, p_user_id: uid });
    }
    return { ok: true, added };
  } catch (e: any) {
    console.error("[collectionInvite] inviteUsersToCollection failed:", e?.message ?? e);
    return { ok: false, added: 0, error: e?.message };
  }
}

/** Usuniecie wspoltworcy (wlasciciel) albo wyjscie z kolekcji (sam zainteresowany) - RLS rozstrzyga. */
export async function removeCollectionMember(collectionId: string, userId: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("discovery_collection_members")
    .delete()
    .eq("collection_id", collectionId)
    .eq("user_id", userId);
  if (error) { console.warn("[collectionInvite] remove:", error.message); return false; }
  return true;
}

/** Wspoltworcy dla WIELU kolekcji naraz - jedno zapytanie zamiast N (kafelki na profilu).
 *  Zwraca mape bez wlasciciela: on stoi juz jako autor kafelka. */
export async function fetchCollectionMembersBulk(
  collectionIds: string[],
  ownerByCollection?: Map<string, string | null>,
): Promise<Map<string, CollectionMember[]>> {
  const out = new Map<string, CollectionMember[]>();
  if (!collectionIds.length) return out;
  const { data, error } = await (supabase as any)
    .from("discovery_collection_members")
    .select("collection_id, user_id, role, created_at")
    .in("collection_id", collectionIds)
    .order("created_at", { ascending: true });
  // ⚠️ Pusto to NORMALNY wynik dla ogladajacego bez dostepu (RLS), nie blad - kafelek po
  // prostu nie pokaze wspoltworcow. Od migracji 20260915k publiczne kolekcje sa widoczne.
  if (error) { console.warn("[collectionInvite] bulk members:", error.message); return out; }
  const rows = (data ?? []) as any[];
  if (!rows.length) return out;
  const { data: profs } = await (supabase as any)
    .from("profiles").select("id, username, first_name, avatar_url, avatar_frame, avatar_frame_color")
    .in("id", Array.from(new Set(rows.map((r) => r.user_id))));
  const byId = new Map((profs ?? []).map((x: any) => [x.id, x]));
  for (const r of rows) {
    if (ownerByCollection?.get(r.collection_id) === r.user_id) continue;
    const pr: any = byId.get(r.user_id) ?? {};
    const arr = out.get(r.collection_id) ?? [];
    arr.push({
      user_id: r.user_id, role: r.role, created_at: r.created_at,
      username: pr.username ?? null, first_name: pr.first_name ?? null, avatar_url: pr.avatar_url ?? null,
      avatar_frame: pr.avatar_frame ?? null, avatar_frame_color: pr.avatar_frame_color ?? null,
    });
    out.set(r.collection_id, arr);
  }
  return out;
}
