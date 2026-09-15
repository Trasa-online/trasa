import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FramedAvatar } from "@/components/profile/FramedAvatar";

// RZAD UCZESTNIKOW w belce wyjazdu i kolekcji (reguła Nat 2026-09-15, wspolna dla obu):
//   autor ZAWSZE w calosci (awatar + handle)
//   drugi uczestnik tez w calosci, ALE tylko jesli sie miesci
//   reszta jako "+N", a tapniecie otwiera arkusz z pelna lista
//
// Do 15.09 kazdy widok mial wlasna regule: wyjazd pokazywal dwoch uczestnikow z nazwa, potem
// nachodzacy stos awatarow i nieklikalne "+N"; kolekcja - dwie pigulki i tez nieklikalne "+N".
// W obu przypadkach przy dluzszych nickach rzad rozpychal belke albo zawijal sie do drugiej linii.
//
// „Jesli sie miesci" jest MIERZONE, nie zgadywane z dlugosci tekstu: rzad nie zawija sie
// (`flex-nowrap` + `overflow-hidden`), wiec wystarczy porownac `scrollWidth` z `clientWidth`.
// Budzet znakow byl by tanszy, ale rozjezdza sie przy innym kroju, wiekszej czcionce systemowej
// i szerszym ekranie - a to sa realne warunki, nie przypadki brzegowe.

export type Participant = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  avatar_frame?: string | null;
  avatar_frame_color?: string | null;
};

export function ParticipantsRow({ author, others, onOpenAll, onOpenPerson, className = "" }: {
  /** Pigulka autora - kazdy widok ma swoja (peachy w wyjezdzie, biala na kolorowej belce). */
  author: ReactNode;
  others: Participant[];
  /** Tapniecie w "+N" - otwiera arkusz z pelna lista. */
  onOpenAll: () => void;
  onOpenPerson?: (p: Participant) => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showSecond, setShowSecond] = useState(true);
  const second = others[0];
  const key = others.map((o) => o.id).join(",");

  // Zmienil sie sklad - sprobuj pokazac drugiego od nowa (inaczej raz schowany zostalby
  // schowany tez wtedy, gdy nowy nick jest krotki).
  useLayoutEffect(() => { setShowSecond(true); }, [key]);

  // Jeden dodatkowy przebieg: jesli rzad sie nie miesci, chowamy drugiego. `showSecond` w
  // warunku pilnuje, zeby nie bylo petli - po schowaniu nie ma juz czego chowac.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || !showSecond || !second) return;
    if (el.scrollWidth > el.clientWidth + 1) setShowSecond(false);
  });

  // "+N" liczy WSZYSTKICH, ktorych nie widac - razem z drugim, gdy sie nie zmiescil.
  const hidden = others.length - (showSecond && second ? 1 : 0);

  return (
    <div ref={wrapRef} className={`flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden ${className}`}>
      {/* ⚠️ Dopoki pokazujemy drugiego, autor jest SZTYWNY (`shrink-0`). Bez tego flex zgniata
          jego pigulke, rzad nigdy nie przekracza szerokosci kontenera, pomiar nie wykrywa
          przepelnienia - i zamiast schowac drugiego, kasujemy nazwe AUTORA (dokladnie odwrotnie
          niz mowi regula). Gdy drugi jest juz schowany, autor moze sie skrocic: to ostatnia
          deska ratunku, gdy sam nick autora nie miesci sie w belce. */}
      <span className={showSecond && second ? "shrink-0" : "min-w-0 shrink"}>{author}</span>
      {showSecond && second && (
        <button
          onClick={() => onOpenPerson?.(second)}
          className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 active:opacity-70 transition-opacity"
        >
          <FramedAvatar src={second.avatar_url} frame={second.avatar_frame} color={second.avatar_frame_color} size={20} />
          <span className="truncate text-[13px] font-bold text-foreground">@{second.username ?? "?"}</span>
        </button>
      )}
      {hidden > 0 && (
        <button
          onClick={onOpenAll}
          className="inline-flex shrink-0 items-center rounded-full bg-white px-2.5 py-1.5 text-[13px] font-bold text-foreground active:opacity-70 transition-opacity"
        >
          {"+" + hidden}
        </button>
      )}
    </div>
  );
}
