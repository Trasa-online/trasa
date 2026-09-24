import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BrandCheck } from "@/components/BrandIcon";
import { useFriendList } from "@/lib/friends";
import { useFollowList } from "@/hooks/useFollow";
import { avatarSrc } from "@/lib/avatar";
import SheetSkeleton from "@/components/layout/SheetSkeleton";
import { EMPTY_ARRAY } from "@/lib/emptyRef";

export interface PersonLite { id: string; username: string | null; first_name: string | null; avatar_url: string | null }

// Multi-select znajomych do wspoltworzenia wyjazdu. Zrodlo: przyjaciele (symetryczni) +
// obserwowani (following), zdeduplikowani. Sterowany: selected (Set id) + onToggle(person).
export default function AddPeoplePicker({
  userId, selected, onToggle, locked,
}: {
  userId: string;
  selected: Set<string>;
  onToggle: (person: PersonLite) => void;
  /** Osoby, ktore juz wspoltworza - wiersz jest przygaszony i nieklikalny. Odbieranie
   *  dostepu ma JEDNO miejsce (krzyzyk przy liscie wspoltworcow), zeby ten sam wiersz nie
   *  znaczyl raz "dodaj", a raz "usun". */
  locked?: Set<string>;
}) {
  const { t } = useTranslation("social");
  // ⚠️ ZNAJOMI = relacja przyjeta przez OBIE strony (`src/lib/friends.ts`, migracja
  // 20260922b). Znajomi sa tu PIERWSI, bo to ich zaprasza sie najczesciej; reszta
  // obserwowanych leci pod nimi.
  // ⛔ Jedno pojecie "znajomy" w calej apce - przez chwile byly dwa (stara tabela
  // `friendships` i wyliczanie z wzajemnych obserwacji) i profil pokazywal 22 znajomych,
  // a ten ekran 4.
  const { data: friends = EMPTY_ARRAY, isLoading: lf } = useFriendList(userId);
  const { data: following = EMPTY_ARRAY, isLoading: lg } = useFollowList(userId, "following");

  const people = useMemo<PersonLite[]>(() => {
    const map = new Map<string, PersonLite>();
    for (const p of [...friends, ...following] as PersonLite[]) if (p?.id && !map.has(p.id)) map.set(p.id, p);
    return [...map.values()];
  }, [friends, following]);

  const loading = lf || lg;

  if (loading) {
    return <SheetSkeleton variant="people" rows={4} />;
  }
  if (!people.length) {
    return (
      <div className="py-10 px-6 text-center">
        <p className="text-sm font-semibold text-foreground">{t("friends.none_yet")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("people.desc")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {people.map((p) => {
        const name = p.username || p.first_name || t("people.user_fallback");
        const on = selected.has(p.id);
        const off = !!locked?.has(p.id);
        return (
          <button key={p.id} onClick={() => { if (!off) onToggle(p); }} disabled={off}
            className={`flex items-center gap-3 px-1 py-2.5 text-left rounded-xl transition-colors ${off ? "opacity-50" : "active:bg-muted/50"}`}>
            <img src={avatarSrc(p.avatar_url)} alt="" className="h-10 w-10 rounded-full object-cover bg-secondary shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-foreground">{name}</span>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${on ? "bg-primary text-white" : "border-2 border-border"}`}>
              {on && <BrandCheck className="h-3.5 w-3.5 stroke-[3]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
