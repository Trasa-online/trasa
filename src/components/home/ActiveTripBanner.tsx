import { useCallback, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { resolveStored } from "@/components/PlacePhoto";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { useTripShortcut } from "@/hooks/useTripShortcut";
import { BrandTripMark } from "@/components/BrandTripMark";
import { tripName, type NamingStrings } from "@/lib/placeNaming";

// SKROT DO WYJAZDU (roboczego albo "w trakcie") = PIGULKA POD GORNA BELKA EKSPLORACJI.
//
// HISTORIA MIEJSCA, bo wracalo dwa razy: do 16.09 byla to NAKLADKA pod belka (szara karta
// shadcn z cieniem, zwezona `pr-28`, zeby nie zaslonic mini-mapy kafelka), 16.09 zeszla NA DOL
// nad `BottomNav`, a 17.09 wrocila na gore na prosbe Nat. Wrocilo MIEJSCE, nie tamten uklad -
// trzy rzeczy z wersji dolnej zostaja, bo rozwiazywaly realne problemy:
//   * KOLORY Z MARKI: zolte tlo `#FDF184`, brazowy tekst `#5B2C06`, pomarancz `#EE5307`
//     WYLACZNIE jako kropka i wersaliki "W TRAKCIE" (na zoltym ma 3,08:1, wiec nigdy nie niesie
//     dluzszego tekstu). ⛔ Zadnego `bg-card` / `bg-muted` - to byly jedyne szarosci Eksploracji.
//   * BIALA OBWODKA 2 px zamiast cienia - zolty `#FDF184` jest tez w palecie kafelkow kolekcji.
//   * PIGULKA HUGUJE TRESC i stoi na srodku, nie rozciaga sie na cala szerokosc.
//
// ⚠️ Element jest W UKLADZIE (zwykly blok miedzy belka a feedem), a NIE `fixed`/`absolute`.
// To wlasnie kasuje powod, dla ktorego wersja sprzed 16.09 miala `pr-28`: skrot nie lezy na
// okladce, tylko stoi nad nia, wiec nie ma czego omijac - ani mini-mapy, ani pigulki autora.
// Feed przewija sie pod spodem (skrot jest POZA scrollerem), wiec jest widoczny caly czas.
//
// KRZYZYK WROCIL (prosba Nat 2026-09-17: "zeby userzy mogli w prosty sposob zamknac ten baner").
// Zdjelismy go 16.09, bo przy pigulce na cala szerokosc zjadal tytul i mial target 24 px.
// Teraz jest OSOBNYM guzikiem obok pigulki i ma pelne 44 px, wiec tamten zarzut nie wraca.
// Gest zostaje jako skrot dla tych, ktorzy go znaja - ale kierunek jest teraz W GORE, bo
// "odsun to z drogi" znaczy tyle, co "schowaj pod belke", przy ktorej element stoi.
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
// Wysokosc calego pasa (pigulka 56 px + gorny odstep 8 px) - potrzebna, bo znikanie robimy
// ZWINIECIEM `max-height`, nie wyjazdem w bok. ⚠️ Wyjazd w gore renderowalby sie NA gornej
// belce: `TabTopBar` nie ma ani tla, ani `z-index`, a skrot stoi po nim w DOM. Zwiniecie
// chowa pigulke pod wlasna krawedzia i przy okazji plynnie dosuwa feed do belki.
const STRIP_PX = 64;

export default function ActiveTripBanner() {
  const { t } = useTranslation("hometrip");
  // Drugi namespace TYLKO dla nazwy zapasowej wyjazdu bez tytulu: "Wyjazd do Hiszpanii"
  // wymaga polskiej odmiany, wiec skladamy ja tym samym helperem co kreator, zamiast
  // dokladac wlasny klucz z przyimkiem (wyszloby "Wyjazd do Hiszpania").
  const { t: tc, i18n } = useTranslation("create-route");
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const { data: trip } = useTripShortcut(!isAnonymous ? user?.id : null);

  // Gest: przeciagniecie W GORE. `offset` to biezace przesuniecie (<= 0), `closing` odpala
  // zwiniecie pasa, a dopiero po nim znika komponent.
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const hideKey = trip ? `${trip.id}:${trip.stage}` : "";
  // Czy ten skrot byl juz schowany W TYM URUCHOMIENIU - czytane RAZ na klucz. Celowo nie przy
  // kazdym renderze: `dismiss` dopisuje do zbioru od razu, wiec odczyt w renderze ubilby
  // komponent w trakcie animacji chowania (skrot znikalby skokiem zamiast sie zwinac).
  const wasHidden = useMemo(() => (hideKey ? dismissedThisRun.has(hideKey) : false), [hideKey]);
  const dismiss = useCallback(() => {
    if (!hideKey) return;
    haptics.light();
    dismissedThisRun.add(hideKey);
    setClosing(true);
    window.setTimeout(() => setHidden(true), 220);
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
    // Tylko wyrazny ruch w gore. Poziomy albo w dol oddajemy tresci (feed pod spodem).
    if (dy > TAP_SLOP || Math.abs(dx) > Math.abs(dy)) { start.current = null; setOffset(0); setDragging(false); return; }
    if (dy < -TAP_SLOP) { moved.current = true; setDragging(true); }
    // Opor przy dalszym ciagnieciu - skrot nie ucieka za daleko za palcem.
    setOffset(Math.max(dy, -72));
  };
  const endDrag = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (-offset >= DISMISS_PX) dismiss();
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
      className="shrink-0 overflow-hidden px-3 pt-2"
      style={{
        maxHeight: closing ? 0 : STRIP_PX,
        opacity: closing ? 0 : 1,
        transition: "max-height 220ms ease-out, opacity 160ms ease-out",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
    >
      <div
        className="flex items-center justify-center gap-2"
        style={{
          transform: `translateY(${offset}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        <button
          onClick={() => {
            // Po przeciagnieciu nie nawigujemy - palec chcial schowac skrot, nie go otworzyc.
            if (moved.current) { moved.current = false; return; }
            haptics.light();
            navigate(`/route/${trip.id}`);
          }}
          className="h-14 min-w-0 max-w-[min(300px,100%)] flex items-center gap-2.5 rounded-full border-2 border-white bg-[#FDF184] pl-2 pr-3.5 text-left active:scale-[0.99] transition-transform"
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
          <span className="min-w-0 flex-1">
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
        {/* Krzyzyk = OSOBNY guzik obok pigulki, w tym samym zoltym i z ta sama biala obwodka
            (to jedna rzecz, nie dwie). ⚠️ Pelne 44 x 44 px - poprzedni krzyzyk siedzial
            W SRODKU pigulki i mial 24 px, i to byl powod jego zdjecia 16.09, nie sam pomysl. */}
        <button
          onClick={dismiss}
          aria-label={t("shortcut.hide")}
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full border-2 border-white bg-[#FDF184] text-[#5B2C06] active:scale-95 transition-transform"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
