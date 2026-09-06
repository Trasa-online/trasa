import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/hooks/useFriends";
import { useFollowList } from "@/hooks/useFollow";
import { avatarSrc } from "@/lib/avatar";
import { Search, Check, X, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteUsersToRoute, type InviteRoute } from "@/lib/groupInvite";
import { cn } from "@/lib/utils";

interface Profile { id: string; username: string | null; first_name: string | null; avatar_url: string | null; }

// Reużywalny sheet t("invite.title"): szukanie po username + multi-select + zaproszenie.
// Dziala na istniejacej trasie (podpina do sesji grupowej jesli trzeba) - patrz inviteUsersToRoute.
export default function InviteFriendsSheet({ open, onOpenChange, route, onInvited, existingMemberIds = [] }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  route: InviteRoute;
  onInvited?: (sessionId: string | undefined, invited: { id: string; avatar_url: string | null }[]) => void;
  existingMemberIds?: string[];
}) {
  const { t } = useTranslation("social");
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, Profile>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => { if (!open) { setQ(""); setResults([]); setSelected({}); } }, [open]);

  // Konta BIZNESOWE (owner_user_id) - do odfiltrowania (biznes != user apki). Jedno zapytanie.
  const { data: bizIds = new Set<string>() } = useQuery({
    queryKey: ["business-owner-ids"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => new Set<string>((((await (supabase as any).from("business_profiles").select("owner_user_id")).data ?? []) as any[]).map((b) => b.owner_user_id).filter(Boolean)),
  });

  // Domyslna lista (puste pole): znajomi + obserwowani (dedup, bez siebie i biznesow) - zeby nie bylo
  // pusto (prosba Nat 2026-08-26).
  const { data: friends = [] } = useFriends(user?.id);
  const { data: following = [] } = useFollowList(user?.id, "following");
  const myPeople = useMemo<Profile[]>(() => {
    const map = new Map<string, Profile>();
    for (const p of [...(friends as any[]), ...(following as any[])]) {
      if (p?.id && p.id !== user?.id && !map.has(p.id) && !(bizIds as Set<string>).has(p.id)) {
        map.set(p.id, { id: p.id, username: p.username ?? null, first_name: p.first_name ?? null, avatar_url: p.avatar_url ?? null });
      }
    }
    return [...map.values()];
  }, [friends, following, user?.id, bizIds]);

  // Szukanie po username (ilike, debounce) - z odfiltrowaniem biznesow.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await (supabase as any).from("profiles")
        .select("id, username, first_name, avatar_url")
        .ilike("username", `%${t}%`)
        .neq("id", user?.id ?? "")
        .not("username", "is", null)
        .limit(20);
      setResults(((data ?? []) as Profile[]).filter((r) => !(bizIds as Set<string>).has(r.id)));
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, user, bizIds]);

  // Userzy JUZ w wyjezdzie (host + czlonkowie) - oznaczeni "Dodano", nie da sie ich wybrac (bez dublowania).
  const existing = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);
  const toggle = (p: Profile) => {
    if (existing.has(p.id)) return;
    setSelected((prev) => {
      const n = { ...prev };
      if (n[p.id]) delete n[p.id]; else n[p.id] = p;
      return n;
    });
  };
  const selectedList = Object.values(selected);
  const searching = q.trim().length >= 2;
  const displayed = searching ? results : myPeople;   // puste pole -> znajomi/obserwowani

  const confirm = async () => {
    if (!user || !selectedList.length || sending) return;
    setSending(true);
    const res = await inviteUsersToRoute(route, selectedList.map((p) => p.id), user.id);
    setSending(false);
    if (!res.ok) { toast.error(t("invite.failed")); return; }
    toast.success(selectedList.length === 1 ? "Zaproszono" : t("invite.sent", { count: selectedList.length }));
    onInvited?.(res.sessionId, selectedList.map((p) => ({ id: p.id, avatar_url: p.avatar_url })));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ height: "80dvh", maxHeight: "80dvh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="text-lg font-black">{t("invite.title")}</p>
          <button onClick={() => onOpenChange(false)} aria-label="Zamknij" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 shrink-0">
          <div className="flex items-center gap-2.5 px-4 h-11 rounded-2xl bg-secondary focus-within:ring-2 focus-within:ring-orange-400/50">
            <Search className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("invite.search_placeholder")}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {displayed.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searching ? t("invite.no_results") : t("invite.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {!searching && displayed.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-2 pb-1">Obserwowani i znajomi</p>
              )}
              {displayed.map((p) => {
                const already = existing.has(p.id);
                const on = !!selected[p.id];
                return (
                  <button key={p.id} onClick={() => toggle(p)} disabled={already} className={cn("flex items-center gap-3 px-2 py-2 rounded-2xl transition-colors text-left", already ? "opacity-55" : "active:bg-muted/50")}>
                    <img src={avatarSrc(p.avatar_url)} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">@{p.username}</p>
                      {p.first_name && <p className="text-xs text-muted-foreground truncate">{p.first_name}</p>}
                    </div>
                    {already ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} /> Dodano
                      </span>
                    ) : (
                      <span className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", on ? "bg-orange-600 border-orange-600" : "border-muted-foreground/30")}>
                        {on && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))] shrink-0 border-t border-border/40">
          <button
            onClick={confirm}
            disabled={!selectedList.length || sending}
            className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-4 w-4" /> {selectedList.length ? t("invite.cta_count", { count: selectedList.length }) : t("invite.cta")}</>}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
