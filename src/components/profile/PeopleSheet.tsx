import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { UserMinus, X } from "lucide-react";
import { BrandSearch } from "@/components/BrandIcon";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/profile/FramedAvatar";
import { useFollowList, followUser, unfollowUser, type FollowProfile } from "@/hooks/useFollow";
import {
  useFriendIds, useFriendList, useIncomingFriendRequests,
  respondToFriendRequest, removeFriend as removeFriendship, invalidateFriends, friendIdsKey,
} from "@/lib/friends";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { haptics } from "@/hooks/useHaptics";

export type PeopleTab = "followers" | "friends" | "following";

// ARKUSZ LUDZI = JEDEN ARKUSZ, TRZY ZAKLADKI (kierunek A z eksploracji, wybor Nat 2026-09-17;
// makiety w Figmie: `[NEW] Ekrany` -> "Obserwujacy i obserwowani - eksploracja kierunkow").
//
// Do 17.09 byly to DWA rozne arkusze (wlasny profil i publiczny), oba plaskie: awatar bez
// nakladki, imie, nick - i tyle. Piec rzeczy, ktorych tam nie bylo, a ktore ta lista musi miec:
//   1. PRZELACZNIK. Zeby z obserwujacych przejsc na obserwowanych, trzeba bylo zamknac arkusz,
//      wrocic na profil i tapnac drugi licznik.
//   2. SZUKANIE. Kolejnosc wierszy to bylo to, co akurat zwrocila baza (`.in(ids)`), wiec przy
//      200 osobach lista byla ekranem bez wyjscia.
//   3. STAN RELACJI. Patrzac na swoich obserwujacych nie dalo sie zobaczyc, kogo obserwuje sie
//      z powrotem ani kto jest znajomym - a to jest GLOWNA informacja tej listy.
//   4. AKCJA W WIERSZU. Jedyna akcja bylo wyjscie na cudzy profil, czyli opuszczenie listy.
//   5. NAKLADKI AWATAROW. To byla jedyna lista ludzi w aplikacji bez `FramedAvatar`.
//
// ⛔ Wiersz i guzik to DWA rozne cele dotyku: wiersz otwiera profil, guzik zmienia relacje.
// ⚠️ Filtrowanie jest po stronie KLIENTA, bo listy sa juz w pamieci (jedno zapytanie na
// zakladke). Przy tysiacach obserwujacych trzeba bedzie doloxyc `range()` i szukanie w bazie.

interface Props {
  open: boolean;
  onClose: () => void;
  tab: PeopleTab;
  onTab: (t: PeopleTab) => void;
  /** Czyje listy ogladamy. */
  ownerId: string;
  /** Moje id - relacje w wierszach liczymy ZAWSZE wzgledem mnie, nie wlasciciela listy. */
  myId: string | null | undefined;
  /** Wlasny profil: mozna wypisac ze znajomych, jest baner zaproszen. */
  own: boolean;
  /** Nazwa wlasciciela - na cudzym profilu arkusz musi powiedziec, czyja to lista. */
  ownerName?: string;
  ownerUsername?: string | null;
  /** Stan zero na wlasnym profilu: baner zaproszen + wejscie w szukanie ludzi. */
  emptyExtra?: React.ReactNode;
}

export default function PeopleSheet({ open, onClose, tab, onTab, ownerId, myId, own, ownerName, ownerUsername, emptyExtra }: Props) {
  const { t } = useTranslation("profiles");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<FollowProfile | null>(null);

  // ZAPROSZENIA CZEKAJACE NA MOJA ODPOWIEDZ stoja na gorze zakladki "Znajomi". Powiadomienie
  // jest pierwszym miejscem, gdzie sie odpowiada, ale znika po oznaczeniu jako przeczytane -
  // a zaproszenie ma miec stale miejsce, do ktorego mozna wrocic.
  const requests = useIncomingFriendRequests(open && own && tab === "friends" ? myId ?? null : null);

  // Listy WLASCICIELA profilu (to jest tresc arkusza).
  const followList = useFollowList(open ? ownerId : null, tab === "following" ? "following" : "followers");
  const friendList = useFriendList(open && tab === "friends" ? ownerId : null);
  const source = tab === "friends" ? friendList : followList;

  // MOJE relacje (to jest tresc guzikow i plakietek) - te same niezaleznie od tego, czyja
  // liste ogladam. Na wlasnym profilu jedno z tych zapytan pokrywa sie z lista wyzej;
  // react-query trzyma je pod tym samym kluczem, wiec to nie jest drugie zapytanie.
  const myFollowing = useFollowList(open ? myId ?? null : null, "following");
  const myFriendIds = useFriendIds(open ? myId ?? null : null);
  const followingSet = useMemo(() => new Set((myFollowing.data ?? []).map((p) => p.id)), [myFollowing.data]);
  const friendSet = useMemo(() => new Set(myFriendIds.data ?? []), [myFriendIds.data]);

  const rows = useMemo(() => {
    const all = source.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) =>
      (p.first_name ?? "").toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q));
  }, [source.data, query]);

  const total = (source.data ?? []).length;
  const countLabel = query.trim()
    ? t("people.count_filtered", { shown: rows.length, total })
    : t(`people.count_${tab}`, { count: total, name: ownerName ?? "" });

  const toggleFollow = async (p: FollowProfile) => {
    if (busy) return;
    setBusy(p.id);
    try {
      const isFollowing = followingSet.has(p.id);
      haptics.light();
      if (isFollowing) await unfollowUser(p.id); else await followUser(p.id);
      queryClient.invalidateQueries({ queryKey: ["follow-list"] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts"] });
      queryClient.invalidateQueries({ queryKey: friendIdsKey(myId) });
    } catch {
      toast.error(t("people.follow_failed"));
    } finally {
      setBusy(null);
    }
  };

  // ODPOWIEDZ NA ZAPROSZENIE. Odmowa jest cicha (druga strona nie dostaje powiadomienia)
  // i zostawia jej obserwowanie - patrz `src/lib/friends.ts`.
  const respond = async (p: FollowProfile, accept: boolean) => {
    if (busy) return;
    setBusy(p.id);
    try {
      haptics.light();
      const ok = await respondToFriendRequest(p.id, accept);
      invalidateFriends(queryClient, myId);
      if (!ok) { toast(t("people.request_gone")); return; }
      toast(accept ? t("people.request_accepted") : t("people.request_declined"));
    } catch {
      toast.error(t("profile.friend_remove_failed"));
    } finally {
      setBusy(null);
    }
  };

  // USUNIECIE ZE ZNAJOMYCH. ⚠️ Od 22.09 to NIE jest ciche wykluczenie z relacji domyslnej,
  // tylko zerwanie relacji, na ktora obie strony sie zgodzily - i nie da sie go cofnac jednym
  // tapnieciem (powrot wymaga nowego zaproszenia i jej akceptacji), wiec zamiast toasta
  // z "Cofnij" jest pytanie przed.
  const doRemove = async (p: FollowProfile) => {
    try {
      const ok = await removeFriendship(p.id);
      invalidateFriends(queryClient, myId);
      toast(ok ? t("profile.friend_removed") : t("profile.friend_remove_failed"));
    } catch {
      toast.error(t("profile.friend_remove_failed"));
    }
  };

  const TABS: PeopleTab[] = ["followers", "friends", "following"];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      {/* 82 dvh, nie 72: przy otwartej klawiaturze na 72 zostawaly trzy wiersze (ramka A6). */}
      <SheetContent side="bottom" className="h-[82dvh] flex flex-col p-0">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        <div className="shrink-0 px-5 pb-3 pt-3">
          <SheetTitle className="text-[17px] font-bold">
            {own ? t("people.title_mine") : t("people.title_of", { name: ownerName ?? "" })}
          </SheetTitle>
          {!own && ownerUsername && <p className="text-xs text-muted-foreground">@{ownerUsername}</p>}
        </div>

        {/* Trzy rowne pigulki BEZ liczb: polskie dopelniacze ("124 Obserwujacych") nie mieszcza
            sie w trzech pigulkach na szerokosc telefonu i lamia sie na dwie linie. Liczba stoi
            pod nimi, jako etykieta listy, i zmienia sie razem z zakladka. */}
        <div className="flex shrink-0 gap-[7px] px-5">
          {TABS.map((k) => {
            const on = tab === k;
            return (
              <button
                key={k}
                onClick={() => { haptics.selection(); onTab(k); setQuery(""); }}
                className={`flex-1 rounded-full py-2.5 text-[13px] font-bold transition-colors active:scale-[0.97] ${on ? "bg-[#FDF184] text-[#5B2C06]" : "bg-secondary text-muted-foreground"}`}
              >
                {t(`profile.${k}`)}
              </button>
            );
          })}
        </div>

        <div className="relative mt-3 shrink-0 px-5">
          <BrandSearch className="pointer-events-none absolute left-9 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("people.search_placeholder")}
            autoCapitalize="none"
            autoCorrect="off"
            className="h-11 w-full rounded-full bg-secondary pl-11 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={t("people.clear_search")}
              className="absolute right-8 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {/* Zaproszenia stoja NAD lista i NAD stanem zero: konto bez ani jednego znajomego
              ma pokazac to, na co czeka odpowiedz, a nie sam napis "nie masz znajomych". */}
          {(requests.data ?? []).length > 0 && (
            <div className="pt-3">
              <p className="pb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("people.requests_title", { count: (requests.data ?? []).length })}
              </p>
              <div className="space-y-2">
                {(requests.data ?? []).map((p) => (
                  <div key={p.id} className="rounded-2xl bg-[#FCEDE3] p-3">
                    <button
                      onClick={() => { onClose(); if (p.username) navigate(`/profil/${p.username}`); }}
                      className="flex w-full min-w-0 items-center gap-3 text-left"
                    >
                      <UserAvatar userId={p.id} src={p.avatar_url} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-[#5B2C06]">{p.first_name || p.username || ""}</span>
                        {p.username && <span className="block truncate text-[12px] text-[#9A7B63]">@{p.username}</span>}
                      </span>
                    </button>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => void respond(p, true)}
                        disabled={busy === p.id}
                        className="h-9 flex-1 rounded-full bg-primary text-[13px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                      >
                        {t("people.request_accept")}
                      </button>
                      <button
                        onClick={() => void respond(p, false)}
                        disabled={busy === p.id}
                        className="h-9 flex-1 rounded-full border border-[#E6D6C8] bg-white text-[13px] font-semibold text-[#5B2C06] transition-transform active:scale-[0.98] disabled:opacity-60"
                      >
                        {t("people.request_decline")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {source.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("people.loading")}</p>
          ) : rows.length === 0 ? (
            // Stan zero stoi POD zakladkami, ktore zostaja widoczne - user ma widziec, ze
            // druga zakladka moze miec tresc (wzor: Wabi).
            <div className="space-y-4 pt-8">
              <p className="text-center text-sm text-muted-foreground">
                {query.trim()
                  ? t("people.no_results", { query: query.trim() })
                  : own
                    ? t(tab === "following" ? "profile.no_following" : tab === "friends" ? "profile.no_friends" : "profile.no_followers")
                    : t(tab === "following" ? "public.no_following" : tab === "friends" ? "people.other_no_friends" : "public.no_followers", { name: ownerName ?? "" })}
              </p>
              {!query.trim() && own && emptyExtra}
            </div>
          ) : (
            <>
              <p className="pb-2 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{countLabel}</p>
              <div className="space-y-0.5">
                {rows.map((p) => {
                  const isMe = !!myId && p.id === myId;
                  const isFriend = friendSet.has(p.id);
                  const isFollowing = followingSet.has(p.id);
                  const name = p.first_name || p.username || "";
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-1.5">
                      <button
                        onClick={() => { onClose(); if (p.username) navigate(`/profil/${p.username}`); }}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1.5 text-left transition-colors active:bg-muted/40"
                      >
                        {/* Nakladka awatara przez UserAvatar - dociaga ramke po userId jednym
                            zapytaniem na cały render (patrz avatarFrameLoader). */}
                        <UserAvatar userId={p.id} src={p.avatar_url} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-foreground">{name}</span>
                          <span className="flex items-center gap-1.5">
                            {isFriend && !isMe && (
                              <span className="shrink-0 rounded-full bg-[#FDF184] px-1.5 py-px text-[10px] font-bold text-[#5B2C06]">{t("people.badge_friend")}</span>
                            )}
                            {p.username && <span className="truncate text-[13px] text-muted-foreground">@{p.username}</span>}
                          </span>
                        </span>
                      </button>

                      {isMe ? (
                        <span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground">{t("people.you")}</span>
                      ) : own && tab === "friends" ? (
                        <button
                          onClick={() => setConfirmRemove(p)}
                          aria-label={t("profile.friend_remove")}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform active:scale-90"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => void toggleFollow(p)}
                          disabled={busy === p.id}
                          className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-bold transition-transform active:scale-[0.97] disabled:opacity-60 ${isFollowing ? "bg-secondary text-muted-foreground" : "bg-primary text-white"}`}
                        >
                          {isFollowing ? t("people.following_state") : t("people.follow")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>

      {/* Pytanie przed zerwaniem: znajomosc wymaga teraz zgody obu stron, wiec jej powrot
          kosztuje nowe zaproszenie i czyjas akceptacje - "Cofnij" w toascie by tego nie oddalo. */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(v) => { if (!v) setConfirmRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>{t("profile.friend_remove_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("profile.friend_remove_desc", { name: confirmRemove?.first_name || confirmRemove?.username || "" })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { const p = confirmRemove; setConfirmRemove(null); if (p) void doRemove(p); }}
            >
              {t("profile.friend_remove")}
            </AlertDialogAction>
            <AlertDialogCancel>{t("profile.friend_remove_cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
