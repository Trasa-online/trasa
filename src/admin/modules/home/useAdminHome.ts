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
  quarantine: number;  // zdjecia w kwarantannie (auto-moderacja NSFW, nie sprawdzone)
  reports: number;     // zgloszenia tresci (content_reports otwarte)
  flags: number;       // flagi miejsc (pending/reviewing)
  bugs: number;        // zgloszenia bledow (nierozwiazane)
  total: number;
}

// Filtr kolejki per typ pending (badge w NAV + klik z karty "Czeka na decyzje").
export const PENDING_ROUTE: Record<keyof Omit<AdminPending, "total">, string> = {
  collections: "/kolejka?typ=kolekcje",
  business: "/kolejka?typ=wizytowki",
  quarantine: "/kolejka?typ=zdjecia",
  reports: "/kolejka?typ=zgloszenia",
  flags: "/kolejka?typ=flagi",
  bugs: "/kolejka?typ=bledy",
};

export function useAdminPending() {
  return useQuery<AdminPending>({
    queryKey: ["admin-pending"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [collections, business, quarantine, reports, flags, bugs] = await Promise.all([
        headCount("discovery_collections", (q) => q.eq("moderation_status", "pending")),
        headCount("business_profiles", (q) => q.eq("moderation_status", "pending").eq("is_draft", false)),
        headCount("image_moderation_log", (q) => q.is("reviewed_at", null)),
        headCount("content_reports", (q) => q.eq("status", "open")),
        headCount("place_flags", (q) => q.in("status", ["pending", "reviewing"])),
        headCount("bug_reports", (q) => q.or("status.is.null,status.neq.resolved")),
      ]);
      return { collections, business, quarantine, reports, flags, bugs, total: collections + business + quarantine + reports + flags + bugs };
    },
  });
}

// Feed "Ostatnio dodane": swieze KOLEKCJE i WYJAZDY od userow + otwarte flagi i bledy.
// Kolekcje i wyjazdy maja `previewId`, bo z tej listy otwiera sie PODGLAD (co dokladnie
// user wrzucil), a nie kolejny ekran - zgloszenie Nat 15.09.2026. Flaga i blad podgladu
// nie maja: tam decyzja zapada w kolejce, nie nad trescia.
export interface ActivityItem {
  id: string;
  kind: "collection" | "trip" | "flag" | "bug";
  title: string;
  subtitle: string;
  date: string | null;
  to: string;
  previewId?: string;
  pending?: boolean;
}

export const ACTIVITY_LABEL: Record<ActivityItem["kind"], string> = {
  collection: "Kolekcja",
  trip: "Wyjazd",
  flag: "Flaga",
  bug: "Błąd",
};

export function useAdminActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ["admin-activity"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const items: ActivityItem[] = [];

      const [{ data: lists }, { data: trips }] = await Promise.all([
        (supabase as any)
          .from("discovery_collections")
          .select("id, title, city, updated_at, moderation_status, user_id")
          .eq("kind", "ranking").eq("is_public", true).not("user_id", "is", null)
          .order("updated_at", { ascending: false }).limit(10),
        (supabase as any)
          .from("routes")
          .select("id, title, city, created_at, user_id, hidden_by_admin")
          .eq("status", "published").not("user_id", "is", null)
          .order("created_at", { ascending: false }).limit(10),
      ]);

      const uids = [...new Set([
        ...(lists ?? []).map((l: any) => l.user_id),
        ...(trips ?? []).map((t: any) => t.user_id),
      ].filter(Boolean))];
      const { data: profs } = uids.length
        ? await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids)
        : { data: [] };
      const author = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.first_name || p.username || "użytkownik"]));

      for (const l of lists ?? []) {
        items.push({
          id: `collection-${l.id}`, kind: "collection", title: l.title || "Kolekcja bez nazwy",
          subtitle: `${author[l.user_id] ?? "użytkownik"}${l.city ? ` · ${l.city}` : ""}`,
          date: l.updated_at, to: "/kolejka?typ=kolekcje", previewId: l.id,
          pending: l.moderation_status === "pending",
        });
      }

      for (const t of trips ?? []) {
        items.push({
          id: `trip-${t.id}`, kind: "trip", title: t.title || "Wyjazd bez nazwy",
          subtitle: `${author[t.user_id] ?? "użytkownik"}${t.city ? ` · ${t.city}` : ""}`,
          date: t.created_at, to: "/kolejka?typ=wyjazdy", previewId: t.id,
          pending: false,
        });
      }

      // Otwarte flagi miejsc.
      const { data: flags } = await (supabase as any)
        .from("place_flags").select("id, reason, created_at")
        .in("status", ["pending", "reviewing"]).order("created_at", { ascending: false }).limit(5);
      for (const f of flags ?? []) {
        items.push({
          id: `flag-${f.id}`, kind: "flag", title: "Zgłoszone zdjęcie albo miejsce",
          subtitle: f.reason || "flaga", date: f.created_at, to: "/kolejka?typ=flagi", pending: true,
        });
      }

      // Nierozwiazane zgloszenia bledow.
      const { data: bugs } = await (supabase as any)
        .from("bug_reports").select("id, description, created_at")
        .or("status.is.null,status.neq.resolved").order("created_at", { ascending: false }).limit(5);
      for (const b of bugs ?? []) {
        items.push({
          id: `bug-${b.id}`, kind: "bug", title: "Zgłoszenie błędu",
          subtitle: (b.description || "").slice(0, 90), date: b.created_at, to: "/kolejka?typ=bledy", pending: true,
        });
      }

      return items.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 20);
    },
  });
}
