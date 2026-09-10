import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { FLIGHT_MS, arcThrough, relRect } from "@/lib/flightPath";
import { localizeTag } from "@/lib/routeTags";
import { Bookmark, Check, MoreHorizontal, Star, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLongPress } from "@/hooks/useLongPress";
import { haptics } from "@/hooks/useHaptics";
import { PlacePhoto } from "@/components/PlacePhoto";
import { avatarSrc } from "@/lib/avatar";

// Oficjalne logo Google (4-kolorowe "G") - guzik "otworz miejsce w Google Maps".
// Rozprysk pieczatki: 8 kresek dookola. Osobna stala, zeby nie liczyc jej przy kazdym renderze.
const STAMP_RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

const GoogleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// Wspoldzielony wiersz miejsca na trasie (widok eksploracji SharedRoute + widok wlasciciela
// ReviewSummary + listy SharedList). Miniaturka 2:3, nazwa (2 linie), chip kategorii, notki,
// a pod spodem akcje po prawej: Google (biale kolko z cieniem) + zapis/kosz.
// dragHandle (opcjonalny) = uchwyt przeciagania po lewej (tryb wlasciciela). note = dodatkowa
// tresc pod wierszem (np. notka autora).
export function RoutePlaceRow({ pin, index, categoryLabel, onOpen, onGoogle, onSave, saved, onDelete, dragHandle, note, cornerAvatar, visited, onToggleVisited, isTop, onToggleTop, visitedAvatar, selection, menuExtras, deleteLabel }: {
  pin: any;
  index: number;
  categoryLabel: ReactNode;
  onOpen: () => void;
  onGoogle: () => void;
  onSave?: () => void; // bookmark: zapisz miejsce do listy (odwiedzone/do odwiedzenia)
  saved?: boolean;     // czy miejsce jest juz w jakiejs liscie usera (wypelniony bookmark)
  onDelete?: () => void; // wlasciciel: usun miejsce z trasy/listy (kosz zamiast bookmarka)
  dragHandle?: ReactNode;
  note?: ReactNode;
  // Awatar uczestnika, ktory DODAL to miejsce (rog miniaturki). undefined = nie pokazuj (brak added_by).
  cornerAvatar?: string | null;
  // "Bylem tu" (2026-09-08). Stan nalezy do OGLADAJACEGO, nie do listy - patrz src/lib/placeVisits.ts.
  // Oba propy sa opcjonalne, wiec ekrany, ktore ich nie podaja (wyjazdy), wygladaja jak dotad.
  visited?: boolean;
  onToggleVisited?: () => void;
  // "Topka" wyjazdu (2026-09-08): autor wyroznia 1-3 miejsca warte polecenia.
  // onToggleTop podaje tylko autor - dla ogladajacych gwiazdka jest sama informacja.
  isTop?: boolean;
  onToggleTop?: () => void;
  /** Awatar osoby, ktorej dotyczy `visited`, gdy NIE jest to ogladajacy (cudza lista).
   *  Obecny = wiersz pokazuje stan PASYWNY: informacje, nie przelacznik. */
  visitedAvatar?: string | null;
  /** Zaznaczanie miejsc w CUDZYM wyjezdzie (2026-09-10). Przytrzymanie wchodzi w tryb,
   *  a w trybie cale tapniecie w wiersz przelacza zaznaczenie - bez celowania w checkbox.
   *  Nieobecne = wiersz zachowuje sie jak dotad. */
  selection?: {
    active: boolean;
    selected: boolean;
    onToggle: () => void;
    onEnter: () => void;
  };
  /** Dodatkowe pozycje menu przy miejscu (notka, zdjecie) - ekran wie, co znaczy "dodaj
   *  notke" w swoim kontekscie (wyjazd: pin_ratings, lista: discovery_items.short_desc),
   *  wiec wiersz tylko je renderuje. Ida na GORZE menu, przed topka/zapisem/koszem. */
  menuExtras?: Array<{ key: string; label: string; icon: ReactNode; onClick: () => void }>;
  /** Napis przy koszu. Domyslnie "Usuń miejsce z trasy" - listy podaja swoja wersje,
   *  bo lista nie jest trasa. */
  deleteLabel?: string;
}) {
  const { t } = useTranslation("route");
  // Gwiazdka LECI z guzika na miejsce przy nazwie (prosba Nat 2026-09-08). Animacja gra tylko
  // przy DODANIU do topki - przy zdejmowaniu byloby to mylace, bo ruch sugeruje "dodalem".
  const rowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const starBtnRef = useRef<HTMLButtonElement>(null);
  const [flight, setFlight] = useState<{ x: number[]; y: number[] } | null>(null);
  // Zdjecie "przyjmuje" pieczatke - krotkie odbicie w momencie ladowania znaczka.
  const [stamped, setStamped] = useState(false);
  // Animujemy TYLKO po tapnieciu w TYM wierszu. Bez tego kazde asynchroniczne dojscie danych
  // (odwiedziny doczytuja sie osobnym zapytaniem PO pierwszym renderze) wyglada dla efektu jak
  // "wlasnie odhaczylem" i cala lista animuje sie naraz - zlapane na probkowaniu: 8 lecacych
  // znaczkow zamiast jednego.
  const tappedTop = useRef(false);
  const tappedVisit = useRef(false);
  const flying = !!flight;
  const wasTop = useRef(!!isTop);

  useEffect(() => {
    if (isTop && !wasTop.current && tappedTop.current) {
      wasTop.current = true;
      tappedTop.current = false;
      // Pozycje MIERZONE, nie stale: wiersz bywa wysoki na 100 px albo na 400 (notka + zdjecia),
      // wiec staly tor trafialby w powietrze. Gdy czegos brakuje, po prostu nie animujemy.
      const row = rowRef.current?.getBoundingClientRect();
      const btn = starBtnRef.current?.getBoundingClientRect();
      const title = titleRef.current?.getBoundingClientRect();
      const thumb = thumbRef.current?.getBoundingClientRect();
      if (!row || !btn || !title) return;

      const b = relRect(row, btn), ti = relRect(row, title);
      const th = thumb ? relRect(row, thumb) : null;
      const from = { x: b.cx, y: b.cy };
      const to = { x: ti.x + 8, y: ti.y + 10 };

      // Topka: z guzika w dol i w lewo (stad "naokolo"), pod spodem zdjecia, potem W GORE
      // PO NIM i gora do nazwy - gwiazdka zostaje przy nazwie, bo to trwale wyroznienie.
      const way = th
        ? [
            from,
            { x: th.x + th.w + 24, y: Math.max(from.y, th.y + th.h) + 14 },
            { x: th.x + th.w * 0.34, y: th.y + th.h * 0.74 },
            { x: th.x + th.w * 0.52, y: th.y + th.h * 0.16 },
            to,
          ]
        : [from, { x: (from.x + to.x) / 2, y: from.y + 46 }, to];
      const { x: xs, y: ys } = arcThrough(way);

      setFlight({ x: xs, y: ys });
      const id = setTimeout(() => setFlight(null), FLIGHT_MS - 80);
      return () => clearTimeout(id);
    }
    wasTop.current = !!isTop;
  }, [isTop]);

  // Przytrzymanie wchodzi w tryb zaznaczania. Poza trybem `onOpen` dziala normalnie - stad
  // `didFire()`: `click` przychodzi PO puszczeniu palca i bez tego otwieralby wizytowke
  // dokladnie w chwili, w ktorej user wlasnie wszedl w zaznaczanie.
  const longPress = useLongPress(selection ? selection.onEnter : undefined, !!selection && !selection.active);
  const selecting = !!selection?.active;
  // Ile akcji miejsca jest w ogole dostepnych - decyduje, czy chowac je pod menu.
  const actionCount = [onToggleTop, onSave, onDelete].filter(Boolean).length + (menuExtras?.length ?? 0);
  // W trybie zaznaczania przelaczenie obsluguje CALY wiersz (onClick nizej). Guziki w srodku
  // musza wiec milczec - inaczej klik przelaczylby raz tutaj i drugi raz po dojsciu do wiersza,
  // czyli wracalby do punktu wyjscia.
  const openOrToggle = () => {
    if (selecting) return;
    if (longPress.didFire()) return;
    onOpen();
  };

  // Odhaczenie odwiedzin = PIECZATKA w miejscu (decyzja Nat 2026-09-08). Wedrowka na
  // miniature zostala wycofana: dla akcji "bylem tu" liczy sie sila przybicia, a nie droga.
  // Lot zostaje wylacznie przy topce, gdzie ma sens - tam gwiazdka MUSI dolecec do nazwy,
  // bo tam zostaje.
  const wasVisited = useRef(!!visited);
  useEffect(() => {
    if (visited && !wasVisited.current && tappedVisit.current) {
      wasVisited.current = true;
      tappedVisit.current = false;
      setStamped(true);
      const off = setTimeout(() => setStamped(false), 620);
      return () => clearTimeout(off);
    }
    wasVisited.current = !!visited;
  }, [visited]);
  return (
    <div
      ref={rowRef}
      {...(selection ? longPress.handlers : {})}
      onClick={selecting ? () => selection!.onToggle() : undefined}
      className={`relative py-4 border-b border-border/70 last:border-b-0 transition-colors ${
        selecting && selection!.selected ? "bg-[#fcede3]" : "bg-background"
      }`}
      /* Zaznaczanie musi wygrac z zaznaczaniem tekstu przez system - inaczej przytrzymanie
         nazwy miejsca podnosi lupe iOS zamiast wejsc w tryb. */
      style={selection ? { WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } : undefined}
    >
      {/* Zdjecie + tresc (nazwa, notki, tagi) */}
      <div className="flex gap-3">
        {dragHandle}
        {/* Peachy kafelek ikony/zdjecia - PIONOWY prostokat 2:3 (redesign 2026-08-25, spojne z okladkami
            miniaturek/kart). self-start: przyklejony do gory wiersza. */}
        <button ref={thumbRef} onClick={openOrToggle} className="relative w-16 h-24 shrink-0 self-start rounded-2xl overflow-hidden bg-[#fcede3] active:opacity-90">
          <PlacePhoto pin={pin} width={80} className="w-full h-full object-cover" />
          {cornerAvatar !== undefined && !selecting && (
            <img src={avatarSrc(cornerAvatar)} alt="" className="absolute bottom-1 right-1 h-7 w-7 rounded-full object-cover border-2 border-white shadow-sm bg-secondary" />
          )}
          {/* Znacznik wyboru na miniaturce - tam, gdzie i tak patrzy oko przy przegladaniu. */}
          {selecting && (
            <span className={`absolute top-1 left-1 h-6 w-6 rounded-full flex items-center justify-center border-2 ${
              selection!.selected ? "bg-primary border-primary text-white" : "bg-white/85 border-white"
            }`}>
              {selection!.selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          {/* Nazwa + badge kategorii (peachy pill po prawej) */}
          <div className="flex items-start justify-between gap-2">
            <button onClick={openOrToggle} className="text-left min-w-0 flex-1">
              <p ref={titleRef} className="text-[16px] font-bold leading-snug line-clamp-2">
                {/* Gwiazdka PRZED nazwa, w jednym ciagu tekstu - inaczej przy nazwie lamiacej
                    sie na dwie linie odjezdzalaby od niej i wygladala jak osobna kontrolka. */}
                {isTop && (
                  <motion.span
                    className="inline-block align-baseline"
                    /* Docelowa gwiazdka jest SCHOWANA, dopoki leci ta animowana - inaczej widac
                       dwie naraz. Wczesniejsza wersja opierala sie na `delay`, ale `flight`
                       powstaje w efekcie, czyli JEDEN render po zmianie `isTop`: przy pierwszym
                       renderze `flying` bylo jeszcze false i gwiazdka pojawiala sie od razu. */
                    initial={false}
                    animate={{ scale: flying ? 0 : 1, rotate: flying ? -140 : 0 }}
                    transition={flying ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 17 }}
                  >
                    <Star className="inline-block h-4 w-4 -mt-0.5 mr-1 text-primary fill-primary" aria-label={t("row.top_place")} />
                  </motion.span>
                )}
                {pin.place_name}
              </p>
            </button>
            <span className="shrink-0 mt-0.5 inline-flex items-center px-2.5 py-1 rounded-full bg-[#fcede3] text-[12px] font-semibold text-foreground">{categoryLabel}</span>
          </div>
          {/* Notka autora + tresc (pod nazwa) */}
          {note && <div className="mt-2">{note}</div>}
          {/* Tagi miejsca (pins.tags) */}
          {Array.isArray(pin.tags) && pin.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pin.tags.map((tg: string) => (
                <span key={tg} className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary text-foreground text-[12px] font-semibold">{localizeTag(tg)}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Akcje miejsca - PRAWA strona wiersza (redesign 2026-08-28): Google bezposrednio po lewej
          od zapisu/kosza. Guzik Google = samo logo w BIALYM kolku z delikatnym cieniem (bez podpisu)
          - cien niesie afordancje "to sie klika", spojnie z kartami i arkuszem dodawania miejsca. */}
      {!selecting && (
      /* data-no-longpress: tapniecie w akcje NIE moze wchodzic w tryb zaznaczania -
         patrz komentarz w useLongPress. */
      <div data-no-longpress className="mt-3 flex items-center justify-end gap-2">
        {/* Cudza lista: autor odhaczyl to miejsce u siebie. Pokazujemy to jako INFORMACJE,
            nie przelacznik - to nie jest moj stan i nie mam go jak zmienic. Awatar mowi CZYJ
            to slad, slowo mowi jaki. */}
        {!onToggleVisited && visited && (
          <span className="h-9 rounded-full flex items-center gap-1.5 px-2.5 shrink-0 bg-[#fcede3] text-[#BC4206]">
            {visitedAvatar !== undefined && (
              <img src={avatarSrc(visitedAvatar)} alt="" className="h-5 w-5 rounded-full object-cover bg-white/60" />
            )}
            <Check className="h-4 w-4 shrink-0" strokeWidth={3} />
            <span className="text-[12px] font-bold whitespace-nowrap">{t("row.visited")}</span>
          </span>
        )}
        {onToggleVisited && (
          /* Po zaznaczeniu guzik ZWIJA sie do samego znaczka (jak polubienie na YouTube):
             tekst tlumaczy AKCJE, a nie powtarza stanu. Kolor schodzi na peachy - odwiedzone
             miejsce ma byc zaznaczone, nie krzyczec mocniej niz przycisk primary. Tekst
             #BC4206 to primary sciemniony do L=38% - na peachy daje 4,68:1, czyli przechodzi
             prog 4,5:1 dla malego pogrubionego tekstu (sam primary mial tam 3,13:1). Wyszarzanie
             zdjecia i znaczek na miniaturce usuniete (prosba Nat 2026-09-08). */
          <motion.button
            onClick={(e) => { e.stopPropagation(); tappedVisit.current = true; onToggleVisited(); }}
            aria-label={visited ? t("row.mark_not_visited") : t("row.mark_visited")}
            aria-pressed={!!visited}
            // PIECZATKA: mocne dobicie w dol, odbicie i powrot. Krotko i twardo - stempel
            // ma "uderzyc", a nie plynnie dojechac, wiec czas jest krotszy niz przy locie
            // gwiazdki, a przeskalowanie glebsze.
            animate={stamped ? { scale: [1, 0.82, 1.12, 0.98, 1] } : { scale: 1 }}
            transition={stamped
              ? { duration: 0.44, times: [0, 0.16, 0.4, 0.7, 1], ease: "easeOut" }
              : { duration: 0.2 }}
            className={`relative h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-[background-color,color,padding] duration-300 ${
              visited ? "bg-[#fcede3] text-[#BC4206] px-2.5" : "bg-secondary text-secondary-foreground px-3"
            }`}
          >
            {/* Elementy WOKOL ikony - bez nich "pieczatka" jest samym skokiem skali.
                Pierscien to fala uderzeniowa, kreski to rozprysk. Oba pointer-events-none
                i poza obiegiem ukladu (absolute), wiec nie ruszaja szerokosci guzika. */}
            <AnimatePresence>
              {stamped && (
                <>
                  <motion.span
                    aria-hidden
                    // Cienka obwodka i nizsze krycie - fala ma byc sugestia, nie ramka
                    // (prosba Nat 2026-09-08). Mniejszy zasieg tez uspokaja calosc.
                    className="pointer-events-none absolute inset-0 rounded-full border border-primary/70"
                    initial={{ scale: 0.7, opacity: 0.55 }}
                    animate={{ scale: 1.75, opacity: 0 }}
                    transition={{ duration: 0.46, ease: "easeOut" }}
                  />
                  {/* Obrot musi siedziec na OPAKOWANIU, a przesuniecie na kresce. Gdy oba sa
                      na jednym elemencie, `rotate` obraca go wokol wlasnego srodka JUZ PO
                      przesunieciu - osiem kresek ladowalo w tym samym punkcie zamiast
                      rozchodzic sie na boki (zlapane na klatce). */}
                  {STAMP_RAYS.map((deg) => (
                    <span
                      key={deg}
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
                      style={{ transform: `rotate(${deg}deg)` }}
                    >
                      <motion.span
                        className="block h-[2px] w-[6px] -mt-[1px] rounded-full bg-primary/80"
                        initial={{ x: 2, opacity: 0, scaleX: 0.4 }}
                        animate={{ x: [2, 14, 19], opacity: [0, 0.85, 0], scaleX: [0.4, 1, 0.5] }}
                        transition={{ duration: 0.46, times: [0, 0.45, 1], ease: "easeOut", delay: 0.04 }}
                      />
                    </span>
                  ))}
                </>
              )}
            </AnimatePresence>
            <Check className="h-4 w-4 shrink-0" strokeWidth={3} />
            {/* max-width + opacity zamiast display:none - inaczej tekst znikalby skokowo. */}
            <span
              className={`overflow-hidden whitespace-nowrap text-[12px] font-bold transition-[max-width,opacity,margin] duration-300 ease-out ${
                visited ? "max-w-0 opacity-0 ml-0" : "max-w-[140px] opacity-100 ml-1.5"
              }`}
            >
              {t("row.visited")}
            </span>
          </motion.button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onGoogle(); }}
          aria-label={t("row.open_in_maps")}
          className="h-9 w-9 rounded-full bg-white border border-black/[0.04] shadow-[0_1px_5px_rgba(0,0,0,0.12)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
        >
          <GoogleGlyph className="h-[18px] w-[18px]" />
        </button>
        {/* Zapis miejsca dostepny ZAWSZE gdy podany onSave - takze dla wlasciciela obok kosza
            (wczesniej kosz go wypieral, wiec we wlasnym wyjezdzie nie dalo sie zapisac miejsca
            do swoich list - zgloszenie Nat 2026-08-29). */}
        {/* Gwiazdka, zapis i kosz zeszly pod TRZY KROPKI (prosba Nat 2026-09-10). Przy wierszu
            z notkami, zdjeciami i tagami cztery ikony obok siebie robily z kazdego miejsca
            panel sterowania; zostaje wiec jedno wejscie w menu. Guzik Google zostaje na
            wierzchu - to jedyna akcja, ktora wykonuje sie w trakcie samego przegladania.
            WYJATEK: gdy zostaje DOKLADNIE JEDNA akcja (cudzy wyjazd = sam zapis), menu nie ma
            czego chowac - pokazujemy ja wprost, w takim samym bialym kolku jak Google
            (prosba Nat 2026-09-10). */}
        {actionCount === 1 && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            aria-label={saved ? t("row.saved_in_list") : t("row.save_to_list")}
            className="h-9 w-9 rounded-full bg-white border border-black/[0.04] shadow-[0_1px_5px_rgba(0,0,0,0.12)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <Bookmark className={`h-[18px] w-[18px] ${saved ? "text-[#F0A583] fill-[#F0A583]" : "text-foreground/70"}`} strokeWidth={2} />
          </button>
        )}
        {(actionCount > 1 || (actionCount === 1 && !onSave)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                ref={starBtnRef}
                onPointerDown={(e) => { e.stopPropagation(); haptics.light(); }}
                aria-label={t("row.more_actions")}
                /* Biale kolko z delikatnym szarym cieniem - dokladnie jak guzik Google obok
                   (prosba Nat 2026-09-10). Sam cien niesie afordancje "to sie klika". */
                className="h-9 w-9 rounded-full bg-white border border-black/[0.04] shadow-[0_1px_5px_rgba(0,0,0,0.12)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
              >
                {/* ZAWSZE trzy kropki (prosba Nat 2026-09-10). Wczesniej ikona menu pokazywala
                    stan (gwiazdka topki / wypelniona zakladka) i przez to wygladala jak guzik
                    zapisu, choc otwierala menu. Topke widac zreszta przy samej NAZWIE miejsca,
                    wiec nic sie nie gubi. */}
                <MoreHorizontal className="h-5 w-5 text-foreground/70" strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl w-60">
              {(menuExtras ?? []).map((x) => (
                <DropdownMenuItem key={x.key} onSelect={() => x.onClick()} className="gap-2.5 py-2.5">
                  {x.icon}{x.label}
                </DropdownMenuItem>
              ))}
              {onToggleTop && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); tappedTop.current = true; onToggleTop(); }} className="gap-2.5 py-2.5">
                  <Star className={`h-4 w-4 ${isTop ? "text-primary fill-primary" : ""}`} />
                  {isTop ? t("row.unset_top") : t("row.set_top")}
                </DropdownMenuItem>
              )}
              {onSave && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSave(); }} className="gap-2.5 py-2.5">
                  <Bookmark className={`h-4 w-4 ${saved ? "text-[#F0A583] fill-[#F0A583]" : ""}`} />
                  {saved ? t("row.saved_in_list") : t("row.save_to_list")}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="gap-2.5 py-2.5 text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  {deleteLabel ?? t("row.remove")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      )}

      {/* Gwiazdka LECI z guzika do nazwy. pointer-events-none, zeby nie lapala tapniec w locie. */}
      <AnimatePresence>
        {flight && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute z-20"
            initial={{ x: flight.x[0], y: flight.y[0], scale: 0.7, rotate: 0, opacity: 0 }}
            animate={{
              x: flight.x,
              y: flight.y,
              // Rosnie w polowie drogi (nad miniatura) i kurczy sie przy ladowaniu.
              scale: [0.7, 1.35, 1.35, 0.5],
              rotate: [0, 200, 380, 520],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              x: { duration: FLIGHT_MS / 1000, ease: "easeInOut" },
              y: { duration: FLIGHT_MS / 1000, ease: "easeInOut" },
              scale: { duration: FLIGHT_MS / 1000, times: [0, 0.35, 0.8, 1], ease: "easeInOut" },
              rotate: { duration: FLIGHT_MS / 1000, ease: "linear" },
              opacity: { duration: FLIGHT_MS / 1000, times: [0, 0.08, 0.86, 1] },
            }}
            style={{ left: -11, top: -11 }}
          >
            <Star className="h-[22px] w-[22px] text-primary fill-primary drop-shadow-md" />
          </motion.span>
        )}
      </AnimatePresence>


    </div>
  );
}
