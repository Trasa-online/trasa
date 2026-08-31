import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function headCount(table: string, apply?: (q: any) => any): Promise<number> {
  let q = (supabase as any).from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count ?? 0;
}

// Liczniki spraw czekajacych na admina - zrodlo badge'ow w NAV i kart "Do zrobienia".
// Klucze mapuja sie 1:1 na routy modulow (patrz PENDING_ROUTE ponizej).
export interface AdminPending {
  collections: number; // listy UGC do moderacji (discovery_collections pending)
  business: number;    // wizytowki do moderacji
  flags: number;       // flagi miejsc (pending/reviewing)
  bugs: number;        // zgloszenia bledow (nierozwiazane)
  total: number;
}

// Route docelowe per typ pending (badge w NAV + klik z karty "Do zrobienia").
export const PENDING_ROUTE: Record<keyof Omit<AdminPending, "total">, string> = {
  collections: "/moderacja",
  business: "/moderacja-b2b",
  flags: "/flagi",
  bugs: "/ops",
};

export function useAdminPending() {
  return useQuery<AdminPending>({
    queryKey: ["admin-pending"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [collections, business, flags, bugs] = await Promise.all([
        headCount("discovery_collections", (q) => q.eq("moderation_status", "pending")),
        headCount("business_profiles", (q) => q.eq("moderation_status", "pending").eq("is_draft", false)),
        headCount("place_flags", (q) => q.in("status", ["pending", "reviewing"])),
        headCount("bug_reports", (q) => q.or("status.is.null,status.neq.resolved")),
      ]);
      return { collections, business, flags, bugs, total: collections + business + flags + bugs };
    },
  });
}

// Feed "Najnowsze do przejrzenia" - swieze UGC (listy) + otwarte flagi + bledy, do
// reaktywnej moderacji (podglad zdjec/notek). Scalone i posortowane po dacie malejaco.
export interface ActivityItem {
  id: string;
  kind: "list" | "flag" | "bug";
  title: string;
  subtitle: string;
  date: string | null;
  to: string;
  pending?: boolean;
}

export function useAdminActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ["admin-activity"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const items: ActivityItem[] = [];

      // Swieze publiczne listy (do przejrzenia zdjec/notek).
      const { data: lists } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, updated_at, moderation_status, user_id")
        .eq("kind", "ranking").eq("is_public", true).not("user_id", "is", null)
        .order("updated_at", { ascending: false }).limit(10);
      const uids = [...new Set((lists ?? []).map((l: any) => l.user_id).filter(Boolean))];
      const { data: profs } = uids.length
        ? await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids)
        : { data: [] };
      const author = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.first_name || p.username || "użytkownik"]));
      for (const l of lists ?? []) {
        items.push({
          id: `list-${l.id}`, kind: "list", title: l.title || "Lista bez nazwy",
          subtitle: `${author[l.user_id] ?? "użytkownik"}${l.city ? ` · ${l.city}` : ""}`,
          date: l.updated_at, to: "/moderacja", pending: l.moderation_status === "pending",
        });
      }

      // Otwarte flagi miejsc.
      const { data: flags } = await (supabase as any)
        .from("place_flags").select("id, reason, created_at")
        .in("status", ["pending", "reviewing"]).order("created_at", { ascending: false }).limit(5);
      for (const f of flags ?? []) {
        items.push({ id: `flag-${f.id}`, kind: "flag", title: "Zgłoszone zdjęcie / miejsce", subtitle: f.reason || "flaga", date: f.created_at, to: "/flagi", pending: true });
      }

      // Nierozwiazane zgloszenia bledow.
      const { data: bugs } = await (supabase as any)
        .from("bug_reports").select("id, description, created_at")
        .or("status.is.null,status.neq.resolved").order("created_at", { ascending: false }).limit(5);
      for (const b of bugs ?? []) {
        items.push({ id: `bug-${b.id}`, kind: "bug", title: "Zgłoszenie błędu", subtitle: (b.description || "").slice(0, 90), date: b.created_at, to: "/ops", pending: true });
      }

      return items.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 15);
    },
  });
}
