import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";

// Talia okladek miejsc u gory ekranu powitalnego (propozycja Nat 2026-09-14): male karty
// 3:4 ze zdjeciami, ktore userzy dodali do miejsc (place_photos, publiczny odczyt - dziala
// przed logowaniem). Co ~2,4 s wierzchnia karta "wylatuje" na bok i wraca na spod talii,
// a reszta przesuwa sie o jedno miejsce do przodu. Pokazujemy realne miejsca z nazwa
// i miastem - to zapowiedz tresci, nie stockowa ilustracja.

type Card = { key: string; name: string; city: string | null; photo: string };

const DECK = 5;                 // ile kart widac w talii
const SHUFFLE_MS = 2400;
// Pozycja karty w talii wg indeksu od wierzchu: lekki wachlarz, kazda kolejna troche mniejsza i nizej.
const SLOT = [
  { rotate: -4, x: 0, y: 0, scale: 1 },
  { rotate: 5, x: 14, y: 8, scale: 0.96 },
  { rotate: -7, x: -12, y: 14, scale: 0.92 },
  { rotate: 8, x: 18, y: 20, scale: 0.88 },
  { rotate: -2, x: -4, y: 26, scale: 0.84 },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function DeckPhoto({ src, alt }: { src: string; alt: string }) {
  const img = useImageWithFallback(src, 320);
  if (!img.src || img.failed) return <div className="h-full w-full bg-[#fcede3]" />;
  return <img src={img.src} alt={alt} onError={img.onError} draggable={false} className="h-full w-full object-cover" />;
}

export default function WelcomeDeck({ className = "" }: { className?: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [flying, setFlying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("place_photos")
        .select("place_key, place_name, city, photo_url, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled || !data) return;
      // Jedno zdjecie na miejsce, losowa kolejnosc, garsc kart - talia nie musi byc dluga.
      const seen = new Set<string>();
      const uniq: Card[] = [];
      for (const r of data as any[]) {
        const key = String(r.place_key ?? r.place_name ?? "");
        if (!r.photo_url || !r.place_name || seen.has(key)) continue;
        seen.add(key);
        uniq.push({ key, name: r.place_name, city: r.city ?? null, photo: r.photo_url });
      }
      setCards(shuffle(uniq).slice(0, 8));
    })();
    return () => { cancelled = true; };
  }, []);

  // Tasowanie: wierzchnia karta idzie na koniec. Jej klucz pamietamy, zeby dostala "lot" na
  // bok zamiast zwyklego przejscia miedzy pozycjami.
  useEffect(() => {
    if (cards.length < 2) return;
    const id = setInterval(() => {
      setCards((c) => { setFlying(c[0]?.key ?? null); return [...c.slice(1), c[0]]; });
    }, SHUFFLE_MS);
    return () => clearInterval(id);
  }, [cards.length]);

  if (!cards.length) return <div className={`h-[236px] ${className}`} aria-hidden />;

  return (
    <div className={`relative h-[236px] w-full ${className}`} aria-hidden>
      {cards.map((card, i) => {
        const slot = SLOT[Math.min(i, DECK - 1)];
        const hidden = i >= DECK;
        const isFlying = card.key === flying && i === cards.length - 1;
        return (
          <motion.div
            key={card.key}
            className="absolute left-1/2 top-3 h-[188px] w-[141px] -ml-[70px] overflow-hidden rounded-[22px] bg-white shadow-[0_10px_30px_-10px_rgba(91,44,6,0.35)] ring-4 ring-white"
            style={{ zIndex: 20 - i, transformOrigin: "50% 100%" }}
            initial={false}
            animate={isFlying
              // Lot na bok: w prawo, z obrotem, znika - i wraca juz na spod talii.
              ? { x: [0, 190, slot.x], y: [0, -30, slot.y], rotate: [-4, 22, slot.rotate], scale: [1, 0.9, slot.scale], opacity: [1, 0.35, hidden ? 0 : 1] }
              : { x: slot.x, y: slot.y, rotate: slot.rotate, scale: slot.scale, opacity: hidden ? 0 : 1 }}
            transition={isFlying
              ? { duration: 0.85, times: [0, 0.45, 1], ease: "easeInOut" }
              : { type: "spring", stiffness: 260, damping: 26 }}
            onAnimationComplete={() => { if (isFlying) setFlying(null); }}
          >
            <DeckPhoto src={card.photo} alt={card.name} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-2.5 pb-2.5 pt-8">
              <p className="line-clamp-2 text-[12px] font-bold leading-tight text-white">{card.name}</p>
              {card.city && <p className="mt-0.5 truncate text-[10px] font-medium text-white/80">{card.city}</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
