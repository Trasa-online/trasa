import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/hooks/useFriends";
import { useFollowList } from "@/hooks/useFollow";
import { avatarSrc } from "@/lib/avatar";
import { Search, Check, X, Loader2, UserPlus, Clock } from "lucide-react";
import { toast } from "sonner";
import { inviteUsersToRoute, type InviteRoute } from "@/lib/groupInvite";
import { cn } from "@/lib/utils";
import { EMPTY_ARRAY } from "@/lib/emptyRef";

interface Profile { id: string; username: string | null; first_name: string | null; avatar_url: string | null; }

// Reużywalny sheet t("invite.title"): szukanie po username + multi-select + zaproszenie.
// Dziala na istniejacej trasie (podpina do sesji grupowej jesli trzeba) - patrz inviteUsersToRoute.
// Stabilna referencja pustego zbioru - patrz komentarz przy zapytaniu o konta biznesowe.
const EMPTY_IDS: Set<string> = new Set();

export default function InviteFriendsSheet({ open, onOpenChange, route, onInvited, existingMemberIds = [], participants = [], onRemove }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  route: InviteRoute;
  onInvited?: (sessionId: string | undefined, invited: { id: string; avatar_url: string | null }[]) => void;
  existingMemberIds?: string[];
  // Sklad wyjazdu widziany przez HOSTA (2026-09-08): razem z osobami, ktore jeszcze nie
  // potwierdzily. Bez tego pomylka przy zapraszaniu byla nieodwracalna.
  participants?: { id: string; username: string | null; avatar_url: string | null; status: string }[];
  onRemove?: (userId: string) => void | Promise<void>;
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
  //
  // NIE `= new Set()` w destrukturyzacji: to NOWY obiekt przy kazdym renderze, a zapytanie
  // jest wylaczone, dopoki arkusz jest zamkniety - czyli `data` zostaje undefined i domyslka
  // podstawia sie w kolko. Efekt wyszukiwania ma `bizIds` w zaleznosciach, wiec odpalal sie
  // przy kazdym renderze i przez setResults/setLoading wymuszal kolejny. Petla kręciła się
  // BEZ KONCA, dopoki wlasciciel mial otwarty swoj wyjazd (arkusz jest zamontowany zawsze) -
  // 657 obrotow w 7 sekund na pomiarze. Stala referencja zamyka temat.
  const { data: bizIds = EMPTY_IDS } = useQuery({
    queryKey: ["business-owner-ids"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => new Set<string>((((await (supabase as any).from("business_profiles_public").select("owner_user_id")).data ?? []) as any[]).map((b) => b.owner_user_id).filter(Boolean)),
  });

  // Domyslna lista (puste pole): znajomi + obserwowani (dedup, bez siebie i biznesow) - zeby nie bylo
  // pusto (prosba Nat 2026-08-26).
  const { data: friends = EMPTY_ARRAY } = useFriends(user?.id);
  const { data: following = EMPTY_ARRAY } = useFollowList(user?.id, "following");
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

  // Wyslanie z 5-sekundowym oknem na "Cofnij" (wzorzec z komunikatorow, prosba Nat 2026-09-08).
  //
  // Dlaczego opoznienie, a nie cofanie po fakcie: zaproszenie wysyla powiadomienie i push.
  // Wycofanie PO wyslaniu nie odwoła tego, co druga osoba juz zobaczyla na ekranie blokady -
  // a najczestsza pomylka (tapniecie w sasiednia osobe na liscie) wychodzi w pierwszych
  // sekundach. Zamykamy arkusz od razu, zeby czekanie nie blokowalo ekranu.
  const confirm = () => {
    if (!user || !selectedList.length || sending) return;
    const people = selectedList;
    const ids = people.map((p) => p.id);
    onOpenChange(false);
    setSelected({});

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const res = await inviteUsersToRoute(route, ids, user.id);
      if (!res.ok) { toast.error(t("invite.failed")); return; }
      onInvited?.(res.sessionId, people.map((p) => ({ id: p.id, avatar_url: p.avatar_url })));
    }, 5000);

    toast(t("invite.sending", { count: people.length }), {
      duration: 5000,
      action: {
        label: t("invite.undo"),
        onClick: () => { cancelled = true; clearTimeout(timer); toast(t("invite.undone")); },
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ height: "80dvh", maxHeight: "80dvh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="text-lg font-black">{t("invite.title")}</p>
          <button onClick={() => onOpenChange(false)} aria-label={t("common:buttons.close")} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
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
          {/* Sklad wyjazdu - z mozliwoscia usuniecia. "Czeka" = osoba jeszcze nie potwierdzila
              zaproszenia i do tego czasu NIE ma wyjazdu u siebie w Wyjazdach. */}
          {onRemove && participants.length > 0 && !searching && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-2 pb-1">{t("invite.current")}</p>
              <div className="flex flex-col gap-1">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-2xl">
                    <img src={avatarSrc(p.avatar_url)} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">@{p.username ?? "..."}</p>
                      {p.status === "pending" && (
                        <p className="text-xs text-muted-foreground truncate inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {t("invite.awaiting")}
                        </p>
                      )}
                    </div>
                    {/* Napis zamiast samej ikony ludzika z minusem: przy nieodwracalnej akcji
                        (osoba wypada z wyjazdu) ikona kazala sie domyslac, co zrobi
                        (prosba Nat 2026-09-09). */}
                    <button
                      onClick={() => void onRemove(p.id)}
                      className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold text-destructive active:scale-95 transition-transform"
                    >
                      {t("common:buttons.delete")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {displayed.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searching ? t("invite.no_results") : t("invite.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {!searching && displayed.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-2 pb-1">{t("invite.following_friends")}</p>
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
                        <Check className="h-3.5 w-3.5" strokeWidth={3} /> {t("invite.added")}
                      </span>
                    ) : (
                      <span className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", on ? "bg-primary border-primary" : "border-muted-foreground/30")}>
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
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-4 w-4" /> {selectedList.length ? t("invite.cta_count", { count: selectedList.length }) : t("invite.cta")}</>}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
