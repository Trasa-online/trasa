import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Kwarantanna zdjec (auto-moderacja Google Vision SafeSearch) ──────────────
export interface ModImage {
  id: string;
  user_id: string | null;
  context: string | null;
  source_url: string;
  quarantine_path: string | null;
  verdict: string;
  scores: any;
  created_at: string;
  reviewed_at: string | null;
  reviewer_note: string | null;
  author: string | null;
}

export function useModerationImages(reviewed: boolean) {
  return useQuery<ModImage[]>({
    queryKey: ["mod-images", reviewed],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = (supabase as any).from("image_moderation_log").select("*").order("created_at", { ascending: false }).limit(200);
      q = reviewed ? q.not("reviewed_at", "is", null) : q.is("reviewed_at", null);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const authors: Record<string, string | null> = {};
      if (uids.length) {
        const { data: profs } = await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids);
        (profs ?? []).forEach((p: any) => { authors[p.id] = p.username || p.first_name || null; });
      }
      return rows.map((r) => ({ ...r, author: authors[r.user_id] ?? null }));
    },
  });
}

export function useReviewImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await (supabase as any).from("image_moderation_log")
        .update({ reviewed_at: new Date().toISOString(), reviewer_note: note.trim() || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mod-images"] }); qc.invalidateQueries({ queryKey: ["admin-pending"] }); },
  });
}

// Podpisany URL do podgladu (plik w prywatnym buckecie moderation-quarantine, 5 min).
export async function signQuarantine(path: string): Promise<string | null> {
  try {
    const { data } = await (supabase as any).storage.from("moderation-quarantine").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  } catch { return null; }
}

// ── Zgloszenia tresci (content_reports: route | collection | user) ───────────
export interface ContentReport {
  id: string;
  target_type: string;   // route | collection | user
  target_id: string;
  reporter_id: string;
  reason: string;
  note: string | null;
  status: string;        // open | reviewed | dismissed
  created_at: string;
  reporter: string | null;
  targetLabel: string | null;
}

export function useContentReports(open: boolean) {
  return useQuery<ContentReport[]>({
    queryKey: ["content-reports", open],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = (supabase as any).from("content_reports").select("*").order("created_at", { ascending: false }).limit(200);
      q = open ? q.eq("status", "open") : q.neq("status", "open");
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const uids = [...new Set(rows.map((r) => r.reporter_id).filter(Boolean))];
      const rep: Record<string, string | null> = {};
      if (uids.length) {
        const { data: pf } = await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids);
        (pf ?? []).forEach((p: any) => { rep[p.id] = p.username || p.first_name || null; });
      }
      const labels: Record<string, string> = {};
      const ids = (type: string) => rows.filter((r) => r.target_type === type).map((r) => r.target_id);
      const routeIds = ids("route"), colIds = ids("collection"), userIds = ids("user");
      if (routeIds.length) { const { data } = await (supabase as any).from("routes").select("id, title").in("id", routeIds); (data ?? []).forEach((x: any) => labels[x.id] = x.title || "Wyjazd"); }
      if (colIds.length) { const { data } = await (supabase as any).from("discovery_collections").select("id, title").in("id", colIds); (data ?? []).forEach((x: any) => labels[x.id] = x.title || "Lista"); }
      if (userIds.length) { const { data } = await (supabase as any).from("profiles").select("id, username").in("id", userIds); (data ?? []).forEach((x: any) => labels[x.id] = "@" + (x.username || "user")); }
      return rows.map((r) => ({ ...r, reporter: rep[r.reporter_id] ?? null, targetLabel: labels[r.target_id] ?? null }));
    },
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "reviewed" | "dismissed" }) => {
      const { data: { user } } = await (supabase as any).auth.getUser();
      const { error } = await (supabase as any).from("content_reports")
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-reports"] }); qc.invalidateQueries({ queryKey: ["admin-pending"] }); },
  });
}
