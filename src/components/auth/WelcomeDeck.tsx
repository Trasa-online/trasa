import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";
import { listTheme } from "@/lib/listThemes";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { resolveStored } from "@/components/PlacePhoto";

// Talia okladek u gory ekranu powitalnego (propozycja Nat 2026-09-14): karty 3:4 - okladki
// MIEJSC (zdjecia userow z place_photos) przeplatane kafelkami KOLEKCJI (kolorowe tlo z palety
// + mini-siatka miejsc + tytul, jak w Eksploracji). Oba zrodla maja publiczny odczyt, wiec
// dzialaja przed logowaniem. Co ~2,4 s wierzchnia karta wysuwa sie w bok i CHOWA POD spod
// talii (bez zanikania - to tasowanie, nie przenikanie), a reszta przesuwa sie do przodu.

type PlaceCard = { kind: "place"; key: string; name: string; city: string | null; photo: string };
type ListCard = { kind: "list"; key: string; title: string; city: string | null; bg: string; ink: string; photos: (string | null)[]; icons: string[] };
type Card = PlaceCard | ListCard;

const DECK = 5;                 // ile kart widac w talii
const SHUFFLE_MS = 2400;
const FLY_MS = 900;
const CARD_W = 176;
const CARD_H = 234;
// Pozycja karty w talii wg indeksu od wierzchu: lekki wachlarz, kazda kolejna troche mniejsza i nizej.
const SLOT = [
  { rotate: -4, x: 0, y: 0, scale: 1 },
  { rotate: 5, x: 16, y: 8, scale: 0.96 },
  { rotate: -7, x: -14, y: 14, scale: 0.92 },
  { rotate: 8, x: 20, y: 20, scale: 0.88 },
  { rotate: -2, x: -4, y: 26, scale: 0.84 },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Przeplot: miejsce, kolekcja, miejsce... - obie tresci maja byc widoczne od razu.
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
}

function DeckPhoto({ src, alt, size = 360 }: { src: string; alt: string; size?: number }) {
  const img = useImageWithFallback(src, size);
  if (!img.src || img.failed) return <div className="h-full w-full bg-[#fcede3]" />;
  return <img src={img.src} alt={alt} onError={img.onError} draggable={false} className="h-full w-full object-cover" />;
}

function ListMini({ photo, icon }: { photo: string | null; icon: string }) {
  const img = useImageWithFallback(photo, 160);
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#fcede3]">
      {photo && img.src && !img.failed
        ? <img src={img.src} alt="" onError={img.onError} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        : <img src={icon} alt="" draggable={false} className="absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 opacity-90" />}
    </div>
  );
}

export default function WelcomeDeck({ className = "" }: { className?: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  // Karta w locie: klucz + faza. "out" = jeszcze NAD talia (wysuwa sie w bok), "under" = juz
  // pod spodem (wraca na koniec). Zmiana fazy przelacza tylko z-index, animacja leci dalej.
  const [flying, setFlying] = useState<{ key: string; phase: "out" | "under" } | null>(null);
  const phaseTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [photosRes, colsRes] = await Promise.all([
        (supabase as any).from("place_photos").select("place_key, place_name, city, photo_url").order("created_at", { ascending: false }).limit(60),
        (supabase as any).from("discovery_collections").select("id, title, city, theme").eq("is_public", true).eq("list_status", "visited").order("created_at", { ascending: false }).limit(12),
      ]);
      if (cancelled) return;
      // Jedno zdjecie na miejsce, losowa kolejnosc.
      const seen = new Set<string>();
      const places: PlaceCard[] = [];
      for (const r of (photosRes.data ?? []) as any[]) {
        const key = String(r.place_key ?? r.place_name ?? "");
        if (!r.photo_url || !r.place_name || seen.has(key)) continue;
        seen.add(key);
        places.push({ kind: "place", key: `p-${key}`, name: r.place_name, city: r.city ?? null, photo: r.photo_url });
      }
      // Kolekcje: 3 pierwsze miejsca na mini-siatke (zdjecie usera albo ikona kategorii).
      const cols = ((colsRes.data ?? []) as any[]).filter((c) => c.title);
      let lists: ListCard[] = [];
      if (cols.length) {
        const { data: items } = await (supabase as any)
          .from("discovery_items").select("collection_id, photo_url, images, category, order_index")
          .in("collection_id", cols.map((c) => c.id)).order("order_index", { ascending: true }).limit(240);
        if (cancelled) return;
        const byCol = new Map<string, any[]>();
        for (const it of (items ?? []) as any[]) { const arr = byCol.get(it.collection_id) ?? []; if (arr.length < 3) arr.push(it); byCol.set(it.collection_id, arr); }
        lists = cols
          .map((c) => {
            const its = byCol.get(c.id) ?? [];
            const th = listTheme(c.theme, c.id);
            return {
              kind: "list" as const, key: `l-${c.id}`, title: c.title, city: c.city ?? null, bg: th.bg, ink: th.ink,
              photos: its.map((it) => resolveStored((Array.isArray(it.images) && it.images[0]) || it.photo_url || null)),
              icons: its.map((it) => categoryIconSrc(it.category ?? null)),
            };
          })
          .filter((l) => l.photos.length >= 2);
      }
      setCards(interleave<Card>(shuffle(places).slice(0, 5), shuffle(lists).slice(0, 4)));
    })();
    return () => { cancelled = true; };
  }, []);

  // Tasowanie: wierzchnia karta idzie na koniec talii.
  useEffect(() => {
    if (cards.length < 2) return;
    const id = setInterval(() => {
      setCards((c) => {
        const top = c[0];
        if (!top) return c;
        setFlying({ key: top.key, phase: "out" });
        if (phaseTimer.current) clearTimeout(phaseTimer.current);
        // Polowa lotu = karta jest juz poza talia, moze zejsc pod spod.
        phaseTimer.current = window.setTimeout(() => setFlying({ key: top.key, phase: "under" }), FLY_MS * 0.45);
        return [...c.slice(1), top];
      });
    }, SHUFFLE_MS);
    return () => { clearInterval(id); if (phaseTimer.current) clearTimeout(phaseTimer.current); };
  }, [cards.length]);

  if (!cards.length) return <div className={`h-[280px] ${className}`} aria-hidden />;

  return (
    <div className={`relative h-[280px] w-full ${className}`} aria-hidden>
      {cards.map((card, i) => {
        const slot = SLOT[Math.min(i, DECK - 1)];
        const isFlying = flying?.key === card.key && i === cards.length - 1;
        // Karta w locie zostaje NA WIERZCHU, dopoki nie wysunie sie z talii; potem idzie pod spod.
        const z = isFlying && flying?.phase === "out" ? 40 : 20 - i;
        return (
          <motion.div
            key={card.key}
            className="absolute left-1/2 top-3 overflow-hidden rounded-[22px] shadow-[0_12px_32px_-12px_rgba(91,44,6,0.45)]"
            style={{ width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, zIndex: z, transformOrigin: "50% 100%", backgroundColor: card.kind === "list" ? card.bg : "#fcede3" }}
            initial={false}
            animate={isFlying
              // Wysuniecie w prawo z lekkim obrotem i powrot juz pod talia - bez zanikania.
              ? { x: [0, CARD_W * 1.15, slot.x], y: [0, 6, slot.y], rotate: [-4, 16, slot.rotate], scale: [1, 0.97, slot.scale] }
              : { x: slot.x, y: slot.y, rotate: slot.rotate, scale: slot.scale }}
            transition={isFlying
              ? { duration: FLY_MS / 1000, times: [0, 0.45, 1], ease: "easeInOut" }
              : { type: "spring", stiffness: 260, damping: 26 }}
            onAnimationComplete={() => { if (isFlying) setFlying(null); }}
          >
            {card.kind === "place" ? (
              <>
                <DeckPhoto src={card.photo} alt={card.name} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-3 pb-3 pt-10">
                  <p className="line-clamp-2 text-[13px] font-bold leading-tight text-white">{card.name}</p>
                  {card.city && <p className="mt-0.5 truncate text-[11px] font-medium text-white/80">{card.city}</p>}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col p-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {card.photos.slice(0, 3).map((ph, k) => <ListMini key={k} photo={ph} icon={card.icons[k] ?? categoryIconSrc(null)} />)}
                </div>
                <div className="mt-auto">
                  <p className="line-clamp-2 text-[14px] font-bold leading-tight" style={{ color: card.ink }}>{card.title}</p>
                  {card.city && <p className="mt-0.5 truncate text-[11px] font-medium" style={{ color: card.ink, opacity: 0.8 }}>{card.city}</p>}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
