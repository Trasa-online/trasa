import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrandHeart } from "@/components/BrandHeart";
import { haptics } from "@/hooks/useHaptics";

// Serce polubienia wyjazdu (belka tytulu w SharedRoute) z animacja (prosba Nat 2026-09-14):
//  - POLUBIENIE: serce "pompuje sie" (spring), z kolka wychodzi fala i szesc malych serduszek
//    rozlatuje sie na boki, licznik wjezdza od dolu; haptyka srednia.
//  - COFNIECIE: serce sie "sflacza" (lekki przechyl i skurcz), kontur wraca, fala zapada sie
//    do srodka; haptyka lekka.
// Stan `liked` jest optymistyczny (cache zapytania) - animacja gra na tapnieciu, nie na
// odpowiedzi serwera, wiec reakcja jest natychmiastowa.

const PETALS = [0, 60, 120, 180, 240, 300];

export default function TripLikeButton({ liked, count, onToggle, label }: {
  liked: boolean; count: number; onToggle: () => void; label: string;
}) {
  // Kazde tapniecie = nowy klucz, zeby ta sama animacja mogla zagrac drugi raz z rzedu.
  const [burst, setBurst] = useState<{ id: number; kind: "like" | "unlike" } | null>(null);
  const tap = () => {
    const kind = liked ? "unlike" : "like";
    if (kind === "like") haptics.medium(); else haptics.light();
    setBurst({ id: Date.now(), kind });
    onToggle();
  };
  const liking = burst?.kind === "like";
  return (
    <button onClick={tap} aria-label={label} aria-pressed={liked} className="relative shrink-0 h-9 flex items-center gap-1 px-1">
      <span className="relative flex h-7 w-7 items-center justify-center">
        <motion.span
          key={burst?.id ?? "idle"}
          className="flex"
          initial={false}
          animate={burst
            ? (liking
              ? { scale: [1, 0.7, 1.35, 0.92, 1], rotate: [0, 0, -8, 4, 0] }
              : { scale: [1, 1.12, 0.72, 1.04, 1], rotate: [0, 10, -10, 4, 0] })
            : { scale: 1, rotate: 0 }}
          transition={burst
            ? { duration: liking ? 0.55 : 0.48, times: [0, 0.18, 0.5, 0.8, 1], ease: "easeOut" }
            : { duration: 0.15 }}
          onAnimationComplete={() => { if (burst) setBurst(null); }}
        >
          <BrandHeart filled={liked} className="h-7 w-7 text-primary" />
        </motion.span>
        <AnimatePresence>
          {burst && (
            <>
              {/* Fala: przy polubieniu ROSNIE na zewnatrz, przy cofnieciu ZAPADA sie do srodka. */}
              <motion.span
                key={`ring-${burst.id}`}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary"
                initial={liking ? { scale: 0.6, opacity: 0.75 } : { scale: 1.7, opacity: 0.45 }}
                animate={liking ? { scale: 2.3, opacity: 0 } : { scale: 0.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: liking ? 0.55 : 0.4, ease: "easeOut" }}
              />
              {liking && PETALS.map((deg) => (
                <span key={`p-${burst.id}-${deg}`} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${deg}deg)` }}>
                  <motion.span
                    className="block -mt-[5px] -ml-[5px]"
                    initial={{ x: 6, opacity: 0, scale: 0.4 }}
                    animate={{ x: [6, 22, 30], opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
                    transition={{ duration: 0.6, times: [0, 0.45, 1], ease: "easeOut", delay: 0.06 }}
                  >
                    <BrandHeart className="h-[10px] w-[10px] text-primary" />
                  </motion.span>
                </span>
              ))}
            </>
          )}
        </AnimatePresence>
      </span>
      {/* Licznik: nowa wartosc wjezdza od dolu przy polubieniu, od gory przy cofnieciu. */}
      <span className="relative h-5 min-w-[10px] overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {count > 0 && (
            <motion.span
              key={count}
              className="block text-sm font-bold tabular-nums text-primary leading-5"
              initial={{ y: liking ? 10 : -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: liking ? -10 : 10, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}
