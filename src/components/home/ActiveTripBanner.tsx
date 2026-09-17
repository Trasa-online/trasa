import { useCallback, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { resolveStored } from "@/components/PlacePhoto";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { useTripShortcut } from "@/hooks/useTripShortcut";
import { BrandTripMark } from "@/components/BrandTripMark";
import { tripName, type NamingStrings } from "@/lib/placeNaming";

// SKROT DO WYJAZDU = PIGULKA NAD DOLNA NAWIGACJA (kierunek A, wybor Nat 2026-09-16;
// makiety: Figma `[NEW] Ekrany` -> "Skrot do wyjazdu na Eksploracji - eksploracja kierunkow").
//
// Do 16.09 to byla NAKLADKA pod gorna belka: szara karta shadcn z cieniem, chowana w GORE
// i zwezona `pr-28`, zeby nie zaslonic mini-mapy kafelka pod spodem. Cztery rzeczy zmienily
// sie razem, bo wynikaja z jednej decyzji "to jest rzecz w toku, a nie tresc do odkrywania":
//
//  1. MIEJSCE. Element zeszedl na dol, nad `BottomNav` - tam, gdzie iOS trzyma rzeczy w toku
//     (Apple Books, Spotify). To kasuje `pr-28` U ZRODLA: na dole nie ma czego omijac, wiec
//     nie ma juz projektowania "dookola przeszkody". Skrot jest tez STALE widoczny - nie chowa
//     sie po przewinieciu feedu, bo skrot, ktorego trzeba szukac, przestaje byc skrotem.
//  2. KOLORY Z MARKI. Zolte tlo `#FDF184`, brazowy tekst i chevron `#5B2C06`, a pomarancz
//     `#EE5307` WYLACZNIE jako kropka i etykieta stanu "w trakcie". ⛔ Zadnego `bg-card`,
//     `bg-muted` ani prawie czarnego kolka - to byly jedyne szarosci shadcn w Eksploracji.
//  3. SEPARACJA PRZEZ OBWODKE, NIE CIEN. Element lezy na zdjeciu okladki, a cien tam nie
//     oddziela, tylko brudzi. Biala obwodka 2 px rozwiazuje tez KOLIZJE: zolty `#FDF184` jest
//     w palecie kafelkow kolekcji, wiec bez niej zolty skrot na zoltej kolekcji znika
//     (sprawdzone na makiecie A3).
//  4. GEST W DOL. Skoro element siedzi przy dolnej krawedzi, "odsun to z drogi" znaczy teraz
//     w dol. Krzyzyk zniknal - przy tej szerokosci zjadal tytul, a jego target mial 24 px
//     zamiast wymaganych 44 (cala pigulka ma 56 px wysokosci, wiec target jest z zapasem).
//
// SCHOWANIE ZYJE TYLKO DO ZAMKNIECIA APLIKACJI (prosba Nat 2026-09-16: "pojedyncze zamkniecie
// nie powinno wywolywac calkowitego zamkniecia na zawsze"). Do tego dnia klucz szedl do
// `localStorage`, wiec jedno machniecie palcem kasowalo skrot do tego wyjazdu NA STALE - a to
// jest skrot do rzeczy NIEDOKONCZONEJ: przy kazdym nowym otwarciu apki ma dostac druga szanse.
//
// Dlatego trzymamy to w PAMIECI MODULU, bez zadnego magazynu: stan przezywa wyjscie z Eksploracji
// i powroty miedzy zakladkami (komponent sie odmontowuje, modul nie), a ginie razem z procesem
// aplikacji - czyli dokladnie przy "nowym otwarciu". Klucz jest per wyjazd ORAZ per etap, wiec
// przejscie roboczy -> w trakcie i tak przywraca skrot wczesniej.
const dismissedThisRun = new Set<string>();

// Sprzatanie po poprzedniej wersji: klucz z `localStorage` nie jest juz czytany, ale bez tego
// wisialby w przegladarce w nieskonczonosc.
const LEGACY_HIDDEN_KEY = "trasa_trip_shortcut_hidden";
try { localStorage.removeItem(LEGACY_HIDDEN_KEY); } catch { /* localStorage niedostepny */ }

// Dystans w px, po ktorym puszczenie palca chowa skrot. Niski prog: to malutki element,
// nie ma tu miejsca na dlugie pociagniecie.
const DISMISS_PX = 36;
// Ruch powyzej tylu px liczymy jako gest, a nie tapniecie - ponizej klik ma dojsc do skutku.
const TAP_SLOP = 6;
// Odstep od dolu = wysokosc pilla nawigacji (64) + 8 px przerwy + jej wlasny dolny margines.
// Trzymane w jednym miejscu, bo zmiana wysokosci `BottomNav` musi ruszyc tez ten element.
const BOTTOM_OFFSET = "calc(max(20px, env(safe-area-inset-bottom, 0px)) + 72px)";

export default function ActiveTripBanner() {
  const { t } = useTranslation("hometrip");
  // Drugi namespace TYLKO dla nazwy zapasowej wyjazdu bez tytulu: "Wyjazd do Hiszpanii"
  // wymaga polskiej odmiany, wiec skladamy ja tym samym helperem co kreator, zamiast
  // dokladac wlasny klucz z przyimkiem (wyszloby "Wyjazd do Hiszpania").
  const { t: tc, i18n } = useTranslation("create-route");
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const { data: trip } = useTripShortcut(!isAnonymous ? user?.id : null);

  // Gest: przeciagniecie W DOL. `offset` to biezace przesuniecie (>= 0), `closing` odpala
  // animacje zjazdu pod krawedz, a dopiero po niej znika komponent.
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const hideKey = trip ? `${trip.id}:${trip.stage}` : "";
  // Czy ten skrot byl juz schowany W TYM URUCHOMIENIU - czytane RAZ na klucz. Celowo nie przy
  // kazdym renderze: `dismiss` dopisuje do zbioru od razu, wiec odczyt w renderze ubilby
  // komponent w trakcie animacji chowania (skrot znikalby skokiem zamiast zjechac w dol).
  const wasHidden = useMemo(() => (hideKey ? dismissedThisRun.has(hideKey) : false), [hideKey]);
  const dismiss = useCallback(() => {
    if (!hideKey) return;
    haptics.light();
    dismissedThisRun.add(hideKey);
    setClosing(true);
    window.setTimeout(() => setHidden(true), 200);
  }, [hideKey]);

  const onTouchStart = (e: ReactTouchEvent<HTMLElement>) => {
    if (closing) return;
    const p = e.touches[0];
    start.current = { x: p.clientX, y: p.clientY };
    moved.current = false;
  };
  const onTouchMove = (e: ReactTouchEvent<HTMLElement>) => {
    if (!start.current) return;
    const p = e.touches[0];
    const dy = p.clientY - start.current.y;
    const dx = p.clientX - start.current.x;
    // Tylko wyrazny ruch w dol. Poziomy albo w gore oddajemy tresci (feed pod spodem).
    if (dy < -TAP_SLOP || Math.abs(dx) > Math.abs(dy)) { start.current = null; setOffset(0); setDragging(false); return; }
    if (dy > TAP_SLOP) { moved.current = true; setDragging(true); }
    // Opor przy dalszym ciagnieciu - skrot nie ucieka za daleko za palcem.
    setOffset(Math.min(dy, 72));
  };
  const endDrag = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (offset >= DISMISS_PX) dismiss();
    else setOffset(0);
  };

  if (!trip || hidden || wasHidden) return null;

  const ongoing = trip.stage === "ongoing";
  const cover = resolveStored(trip.cover);
  const naming: NamingStrings = {
    collectionIn: tc("naming.collection_in"),
    collectionPlain: tc("naming.collection_plain"),
    tripTo: tc("naming.trip_to"),
    tripPlain: tc("naming.trip_plain"),
    collectionFallback: tc("list_name_default"),
    tripFallback: t("shortcut.fallback"),
    declines: (i18n.language || "pl").toLowerCase().startsWith("pl"),
  };
  const title = trip.title || tripName(trip.city, [], naming);

  return (
    // `data-no-swipe` / `data-no-drag`: gest na skrocie nie moze przelaczac zakladek ani
    // zamykac arkusza, w ktorym Eksploracja czasem siedzi.
    <div
      data-no-swipe
      data-no-drag
      // Pigulka HUGUJE tresc i stoi na srodku, zamiast rozciagac sie na cala szerokosc
      // (zgloszenie Nat 2026-09-17: "za dlugi, nachodzi brzydko na okladki"). Kontener
      // zostaje pelnej szerokosci, bo niesie gest chowania - to guzik w srodku jest waski.
      className="fixed inset-x-0 z-40 flex justify-center px-3"
      style={{
        bottom: BOTTOM_OFFSET,
        transform: `translateY(${closing ? 140 : offset}px)`,
        opacity: closing ? 0 : 1,
        transition: dragging ? "none" : "transform 200ms ease-out, opacity 200ms ease-out",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
    >
      <button
        onClick={() => {
          // Po przeciagnieciu nie nawigujemy - palec chcial schowac skrot, nie go otworzyc.
          if (moved.current) { moved.current = false; return; }
          haptics.light();
          navigate(`/route/${trip.id}`);
        }}
        className="h-14 max-w-[min(320px,100%)] flex items-center gap-2.5 rounded-full border-2 border-white bg-[#FDF184] pl-2 pr-3.5 text-left active:scale-[0.99] transition-transform"
      >
        <span className="h-10 w-10 rounded-xl overflow-hidden bg-[#fcede3] flex items-center justify-center shrink-0">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            /* ⛔ INLINE svg, NIE `BrandIcon` z maska CSS. Ten skrot chowa sie gestem, czyli
               zyje w warstwie z animowanym `transform`, a WebKit na iOS gubi tam
               `-webkit-mask-image` - znak potrafil zniknac albo wyrenderowac sie jako plama.
               Ta sama pulapka, co przy gwiazdkach w nakladkach awatara (CLAUDE.md). */
            <BrandTripMark className="h-5 w-5 block text-[#ef9d78]" />
          )}
        </span>
        <span className="min-w-0 max-w-[214px]">
          <span className="flex items-center gap-1.5">
            {/* Etap wyjazdu. Pomarancz WYLACZNIE dla "w trakcie" - na zoltym tle czyta sie
                slabo (3,08:1), wiec niesie go kropka i wersaliki, nigdy dluzszy tekst.
                ⛔ Przez `t()`: do 2026-09-16 oba napisy byly wpisane po POLSKU wprost w JSX. */}
            {ongoing && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />}
            <span className={`text-[10px] font-bold uppercase tracking-[0.04em] truncate ${ongoing ? "text-primary" : "text-[#5B2C06]/70"}`}>
              {ongoing ? t("shortcut.stage_ongoing") : t("shortcut.stage_draft")}
            </span>
          </span>
          <span className="block text-[15px] font-semibold text-[#5B2C06] truncate">{title}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-[#5B2C06] shrink-0" />
      </button>
    </div>
  );
}
