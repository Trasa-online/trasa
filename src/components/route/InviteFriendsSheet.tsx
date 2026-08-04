import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { avatarSrc } from "@/lib/avatar";
import { Search, Check, X, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteUsersToRoute, type InviteRoute } from "@/lib/groupInvite";
import { cn } from "@/lib/utils";

interface Profile { id: string; username: string | null; first_name: string | null; avatar_url: string | null; }

// Reużywalny sheet "Zaproś znajomych": szukanie po username + multi-select + zaproszenie.
// Dziala na istniejacej trasie (podpina do sesji grupowej jesli trzeba) - patrz inviteUsersToRoute.
export default function InviteFriendsSheet({ open, onOpenChange, route, onInvited }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  route: InviteRoute;
  onInvited?: (sessionId?: string) => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, Profile>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => { if (!open) { setQ(""); setResults([]); setSelected({}); } }, [open]);

  // Szukanie po username (ilike, debounce). Wzorzec z UserSearchDrawer.
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
      setResults(data ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, user]);

  const toggle = (p: Profile) => setSelected((prev) => {
    const n = { ...prev };
    if (n[p.id]) delete n[p.id]; else n[p.id] = p;
    return n;
  });
  const selectedList = Object.values(selected);

  const confirm = async () => {
    if (!user || !selectedList.length || sending) return;
    setSending(true);
    const res = await inviteUsersToRoute(route, selectedList.map((p) => p.id), user.id);
    setSending(false);
    if (!res.ok) { toast.error("Nie udało się zaprosić. Spróbuj ponownie."); return; }
    toast.success(selectedList.length === 1 ? "Zaproszono" : `Zaproszono ${selectedList.length} osób`);
    onInvited?.(res.sessionId);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ height: "80dvh", maxHeight: "80dvh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="text-lg font-black">Zaproś znajomych</p>
          <button onClick={() => onOpenChange(false)} aria-label="Zamknij" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 shrink-0">
          <div className="flex items-center gap-2.5 px-4 h-11 rounded-2xl bg-secondary focus-within:ring-2 focus-within:ring-orange-400/50">
            <Search className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj po nazwie użytkownika"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {q.trim().length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Wpisz nazwę użytkownika, żeby znaleźć znajomych.</p>
          ) : results.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Brak wyników.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {results.map((p) => {
                const on = !!selected[p.id];
                return (
                  <button key={p.id} onClick={() => toggle(p)} className="flex items-center gap-3 px-2 py-2 rounded-2xl active:bg-muted/50 transition-colors text-left">
                    <img src={avatarSrc(p.avatar_url)} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">@{p.username}</p>
                      {p.first_name && <p className="text-xs text-muted-foreground truncate">{p.first_name}</p>}
                    </div>
                    <span className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", on ? "bg-orange-600 border-orange-600" : "border-muted-foreground/30")}>
                      {on && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                    </span>
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
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-4 w-4" /> {selectedList.length ? `Zaproś (${selectedList.length})` : "Zaproś"}</>}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
