import { useCallback, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { resolveStored } from "@/components/PlacePhoto";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { useTripShortcut } from "@/hooks/useTripShortcut";

// Baner-skrot mozna schowac przeciagnieciem W GORE (prosba Nat 2026-09-06) - nakladka lezy
// pod sama belka, wiec ruch "odsun to z drogi" jest naturalnie do gory. Schowanie pamietamy
// per wyjazd ORAZ per etap: nowy wyjazd albo przejscie roboczy -> w trakcie przywraca skrot,
// bo to juz inna sytuacja. Bez tego user musialby chowac to samo w kolko, a jednoczesnie
// raz schowany baner nie moze wracac po kazdym wejsciu na Eksploracje.
const HIDDEN_KEY = "trasa_trip_shortcut_hidden";
const HIDDEN_MAX = 20;

function readHidden(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

function rememberHidden(key: string) {
  try {
    const next = [key, ...readHidden().filter((k) => k !== key)].slice(0, HIDDEN_MAX);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  } catch { /* localStorage niedostepny */ }
}

// Dystans w px, po ktorym puszczenie palca chowa baner. Niski prog: to malutki element,
// nie ma tu miejsca na dlugie pociagniecie.
const DISMISS_PX = 36;
// Ruch powyzej tylu px liczymy jako gest, a nie tapniecie - ponizej klik ma dojsc do skutku.
const TAP_SLOP = 6;

// Mini baner-skrot pod belka eksploracji: wraca jednym tapnieciem do wyjazdu W TRAKCIE, a gdy
// takiego nie ma - do najswiezszego ROBOCZEGO (prosba Nat 2026-08-29). Gdy user nie ma zadnego
// aktywnego wyjazdu, baner sie nie renderuje (zero pustego miejsca w widoku).
export default function ActiveTripBanner({ floating = false }: {
  /** Wariant NAKLADKI nad feedem eksploracji: przyklejony pod gorna belka, nie zajmuje miejsca
      w ukladzie (patrz komentarz przy uzyciu w Explore). Wezszy, zeby nie zaslonic mapki w
      prawym gornym rogu karty, i nieprzezroczysty, bo lezy na zdjeciu. */
  floating?: boolean;
} = {}) {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const { data: trip } = useTripShortcut(!isAnonymous ? user?.id : null);

  // Gest: przeciagniecie w gore. `offset` to biezace przesuniecie (<= 0), `closing` odpala
  // animacje wyjazdu w gore, a dopiero po niej znika komponent.
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const hideKey = trip ? `${trip.id}:${trip.stage}` : "";
  // Czy ten skrot byl juz schowany - czytane RAZ na klucz. Celowo nie przy kazdym renderze:
  // `dismiss` zapisuje do localStorage od razu, wiec odczyt w renderze ubilby komponent
  // w trakcie animacji chowania (baner znikalby skokiem zamiast wyjechac w gore).
  const wasHidden = useMemo(() => (hideKey ? readHidden().includes(hideKey) : false), [hideKey]);
  const dismiss = useCallback(() => {
    if (!hideKey) return;
    haptics.light();
    rememberHidden(hideKey);
    setClosing(true);
    window.setTimeout(() => setHidden(true), 200);
  }, [hideKey]);

  const onTouchStart = (e: ReactTouchEvent<HTMLElement>) => {
    if (!floating || closing) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    moved.current = false;
  };
  const onTouchMove = (e: ReactTouchEvent<HTMLElement>) => {
    if (!start.current) return;
    const t = e.touches[0];
    const dy = t.clientY - start.current.y;
    const dx = t.clientX - start.current.x;
    // Tylko wyrazny ruch w gore. Poziomy albo w dol oddajemy tresci (feed pod spodem).
    if (dy > TAP_SLOP || Math.abs(dx) > Math.abs(dy)) { start.current = null; setOffset(0); setDragging(false); return; }
    if (dy < -TAP_SLOP) { moved.current = true; setDragging(true); }
    // Opor przy dalszym ciagnieciu - baner nie ucieka za daleko za palcem.
    setOffset(Math.max(dy, -72));
  };
  const endDrag = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (offset <= -DISMISS_PX) dismiss();
    else setOffset(0);
  };

  if (!trip || hidden || wasHidden) return null;

  const ongoing = trip.stage === "ongoing";
  const cover = resolveStored(trip.cover);
  const title = trip.title || (trip.city ? `Wyjazd do ${trip.city}` : "Twój wyjazd");

  return (
    <div
      className={floating ? "pl-4 pr-28 pt-1.5" : "px-4 pt-2 shrink-0"}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      style={floating ? {
        transform: `translateY(${closing ? -140 : offset}px)`,
        opacity: closing ? 0 : 1,
        transition: dragging ? "none" : "transform 200ms ease-out, opacity 200ms ease-out",
      } : undefined}
    >
      <button
        onClick={() => {
          // Po przeciagnieciu nie nawigujemy - palec chcial schowac baner, nie go otworzyc.
          if (moved.current) { moved.current = false; return; }
          haptics.light();
          navigate(`/route/${trip.id}`);
        }}
        className={`w-full flex items-center gap-3 rounded-2xl border pl-2 pr-3 py-2 text-left active:scale-[0.99] transition-transform ${
          floating ? "bg-card border-border/60 shadow-md shadow-black/10" : "bg-secondary/70 border-border/50"}`}
      >
        <span className="h-10 w-10 rounded-xl overflow-hidden bg-[#fcede3] flex items-center justify-center shrink-0">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="h-5 w-5 block"
              style={{
                backgroundColor: "#ef9d78",
                WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
                WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
                WebkitMaskSize: "contain", maskSize: "contain",
                WebkitMaskPosition: "center", maskPosition: "center",
              }}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {/* Etap wyjazdu: "W trakcie" ma kolor akcentu, "Robocze" jest wyciszone. */}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ongoing ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {ongoing ? "W trakcie" : "Robocze"}
            </span>
            {trip.city && <span className="text-[11.5px] text-muted-foreground truncate">{trip.city}</span>}
          </span>
          <span className="block text-[14px] font-semibold text-foreground truncate mt-0.5">{title}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}
