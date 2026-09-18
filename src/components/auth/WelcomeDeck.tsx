import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { listTheme } from "@/lib/listThemes";
import { resolveStored } from "@/components/PlacePhoto";
import { scopeLabel } from "@/lib/tripScope";
import { buildTripStaticMapUrl } from "@/lib/staticMap";
import { TripTile, ListTile, LIST_TILES, type GridItem, type GridPlace } from "@/components/home/FeedTiles";

// Talia u gory ekranu powitalnego (propozycja Nat 2026-09-14, przebudowa 2026-09-18): karty
// 9:16 z PRAWDZIWYMI kafelkami z Eksploracji - `TripTile` (okladka, pigulka autora z nakladka
// awatara, mini-mapa, tytul, chipy: miejsca / miasto / dni) i `ListTile` (kolor przewodni
// kolekcji, autor z @nickiem, chipy, tytul, mini-siatka miejsc). To ten sam komponent, ktory
// rysuje feed, wiec kazda zmiana kafelka w apce od razu jest tez tutaj. Do 18.09 talia miala
// wlasne, uproszczone karty (zdjecie miejsca + nazwa / kolor + 3 miniatury), bez miasta,
// autora i nakladek - Nat: "brakuje stylowania takiego jak w apce".
//
// Kafelek renderuje sie w swojej naturalnej szerokosci (`TILE_W`, wariant `grid`) i jest
// SKALOWANY transformem do szerokosci karty - dzieki temu typografia i odstepy sa dokladnie
// te z Eksploracji, tylko mniejsze. Wszystkie zrodla maja publiczny odczyt (RLS), wiec
// dzialaja przed logowaniem: opublikowane wyjazdy z okladka, publiczne kolekcje, profile.
//
// Co ~2,4 s wierzchnia karta wysuwa sie w bok i CHOWA POD spod talii (bez zanikania - to
// tasowanie, nie przenikanie), a reszta przesuwa sie do przodu.

type Card = { key: string; item: GridItem };

const DECK = 5;                 // ile kart widac w talii
const SHUFFLE_MS = 2400;
const FLY_MS = 900;
const CARD_W = 176;
const CARD_H = Math.round(CARD_W * 16 / 9);   // 313 - proporcja okladki wyjazdu
const TILE_W = 224;             // naturalna szerokosc kafelka `grid` przed skalowaniem
const SCALE = CARD_W / TILE_W;
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
// Przeplot: wyjazd, kolekcja, wyjazd... - obie tresci maja byc widoczne od razu.
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
}

type Profile = { id: string; username: string | null; first_name: string | null; avatar_url: string | null; avatar_frame: string | null; avatar_frame_color: string | null };

async function loadCards(): Promise<Card[]> {
  const [routesRes, colsRes] = await Promise.all([
    (supabase as any).from("routes")
      .select("id, title, city, countries, user_id, start_date, end_date, day_number, list_cover_url, share_anonymous")
      .eq("status", "published").eq("is_shared", true).not("list_cover_url", "is", null)
      .order("published_at", { ascending: false }).limit(12),
    (supabase as any).from("discovery_collections")
      .select("id, title, city, countries, theme, user_id")
      .eq("is_public", true).eq("list_status", "visited").order("created_at", { ascending: false }).limit(12),
  ]);
  const routes = ((routesRes.data ?? []) as any[]).filter((r) => r.title && r.list_cover_url);
  const cols = ((colsRes.data ?? []) as any[]).filter((c) => c.title);

  const [pinsRes, itemsRes, profilesRes] = await Promise.all([
    routes.length
      ? (supabase as any).from("pins").select("route_id, place_name, latitude, longitude").in("route_id", routes.map((r) => r.id))
      : Promise.resolve({ data: [] }),
    cols.length
      ? (supabase as any).from("discovery_items").select("collection_id, place_name, category, photo_url, images, order_index")
          .in("collection_id", cols.map((c) => c.id)).order("order_index", { ascending: true }).limit(400)
      : Promise.resolve({ data: [] }),
    (() => {
      const ids = [...new Set([...routes.map((r) => r.user_id), ...cols.map((c) => c.user_id)].filter(Boolean))];
      return ids.length
        ? (supabase as any).from("profiles").select("id, username, first_name, avatar_url, avatar_frame, avatar_frame_color").in("id", ids)
        : Promise.resolve({ data: [] });
    })(),
  ]);
  const profiles = new Map<string, Profile>();
  for (const p of (profilesRes.data ?? []) as Profile[]) profiles.set(p.id, p);

  const pinsByRoute = new Map<string, any[]>();
  for (const p of (pinsRes.data ?? []) as any[]) { const a = pinsByRoute.get(p.route_id) ?? []; a.push(p); pinsByRoute.set(p.route_id, a); }
  const itemsByCol = new Map<string, any[]>();
  for (const it of (itemsRes.data ?? []) as any[]) { const a = itemsByCol.get(it.collection_id) ?? []; a.push(it); itemsByCol.set(it.collection_id, a); }

  const trips: Card[] = routes
    .map((r) => {
      const pins = pinsByRoute.get(r.id) ?? [];
      const prof = r.share_anonymous ? null : profiles.get(r.user_id);
      // Dni jak w feedzie: z zakresu dat, a bez dat - z `day_number` (gdy > 1).
      const days = r.start_date
        ? Math.max(1, Math.round((new Date(r.end_date ?? r.start_date).getTime() - new Date(r.start_date).getTime()) / 86_400_000) + 1)
        : (Number(r.day_number) > 1 ? Number(r.day_number) : null);
      const item: GridItem = {
        kind: "trip", id: r.id, title: r.title,
        cover: resolveStored(r.list_cover_url),
        where: r.city || scopeLabel(r),
        authorName: prof?.username ? `@${prof.username}` : (prof?.first_name ?? ""),
        authorAvatar: prof?.avatar_url ?? null, authorId: prof?.id ?? null,
        authorFrame: prof?.avatar_frame ?? null, authorFrameColor: prof?.avatar_frame_color ?? null,
        showAuthor: !!prof,
        at: 0, placesCount: pins.length, days,
        mapUrl: buildTripStaticMapUrl(pins, "200x200"), pins,
        theme: null, places: [],
      };
      return { key: `t-${r.id}`, item };
    })
    .filter((c) => c.item.placesCount > 0);

  const lists: Card[] = cols
    .map((c) => {
      const its = itemsByCol.get(c.id) ?? [];
      const prof = profiles.get(c.user_id);
      const places: GridPlace[] = its.slice(0, LIST_TILES).map((it) => ({
        name: it.place_name ?? "", category: it.category ?? null,
        photo: resolveStored((Array.isArray(it.images) && it.images[0]) || it.photo_url || null),
      }));
      const item: GridItem = {
        kind: "list", id: c.id, title: c.title,
        cover: places.find((p) => p.photo)?.photo ?? null,
        where: c.city || scopeLabel(c),
        authorName: prof?.first_name || prof?.username || "",
        authorHandle: prof?.username ? `@${prof.username}` : null,
        authorAvatar: prof?.avatar_url ?? null, authorId: prof?.id ?? null,
        authorFrame: prof?.avatar_frame ?? null, authorFrameColor: prof?.avatar_frame_color ?? null,
        showAuthor: !!prof,
        at: 0, placesCount: its.length, days: null, mapUrl: null,
        theme: listTheme(c.theme, c.id), places,
      };
      return { key: `l-${c.id}`, item };
    })
    // Kolekcja bez zdjec to sama siatka ikon - w talii ma byc cos do ogladania.
    .filter((c) => c.item.placesCount >= 3 && c.item.places.some((p) => p.photo));

  return interleave(shuffle(trips).slice(0, 5), shuffle(lists).slice(0, 4));
}

export default function WelcomeDeck({ className = "" }: { className?: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  // Karta w locie: klucz + faza. "out" = jeszcze NAD talia (wysuwa sie w bok), "under" = juz
  // pod spodem (wraca na koniec). Zmiana fazy przelacza tylko z-index, animacja leci dalej.
  const [flying, setFlying] = useState<{ key: string; phase: "out" | "under" } | null>(null);
  const phaseTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCards()
      .then((c) => { if (!cancelled) setCards(c); })
      .catch((e) => console.warn("[WelcomeDeck] load failed:", e instanceof Error ? e.message : e));
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

  const deckH = CARD_H + 40;
  if (!cards.length) return <div style={{ height: deckH }} className={className} aria-hidden />;

  return (
    <div className={`relative w-full ${className}`} style={{ height: deckH }} aria-hidden>
      {cards.map((card, i) => {
        const slot = SLOT[Math.min(i, DECK - 1)];
        const isFlying = flying?.key === card.key && i === cards.length - 1;
        // Karta w locie zostaje NA WIERZCHU, dopoki nie wysunie sie z talii; potem idzie pod spod.
        const z = isFlying && flying?.phase === "out" ? 40 : 20 - i;
        const it = card.item;
        return (
          <motion.div
            key={card.key}
            // `pointer-events-none`: kafelek ma wlasne guziki (mini-mapa) - w talii nic nie jest klikalne.
            className="pointer-events-none absolute left-1/2 top-3 overflow-hidden rounded-[22px] shadow-[0_12px_32px_-12px_rgba(91,44,6,0.45)]"
            style={{ width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, zIndex: z, transformOrigin: "50% 100%", backgroundColor: it.theme?.bg ?? "#fcede3" }}
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
            {/* Kafelek w naturalnej szerokosci, przeskalowany do karty. Wyjazd ma 9:16, wiec
                wypelnia karte co do piksela; kolekcja jest nizsza, wiec stoi WYSRODKOWANA
                w pionie na swoim kolorze (tlo karty = kolor przewodni kolekcji, granicy nie
                widac) - przy gorze zostawala pusta dolna polowa i karta wygladala na urwana. */}
            {it.kind === "trip" ? (
              <div style={{ width: TILE_W, transform: `scale(${SCALE})`, transformOrigin: "0 0" }}>
                <TripTile it={it} size="grid" />
              </div>
            ) : (
              <div className="absolute left-1/2 top-1/2" style={{ width: TILE_W, transform: `translate(-50%, -50%) scale(${SCALE})` }}>
                <ListTile it={it} size="grid" />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
