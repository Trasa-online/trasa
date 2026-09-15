import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid3x3, LayoutGrid, Rows3 } from "lucide-react";
import { haptics } from "@/hooks/useHaptics";

// Trzy uklady opublikowanych wyjazdow (prosba Nat 2026-09-10). Wybor nalezy do OGLADAJACEGO,
// nie do tresci, wiec siedzi w localStorage - to drobna wygoda per urzadzenie, nie dane.
//
// Dlaczego tylko opublikowane: wyjazd roboczy ma na karcie akcje wlasciciela (olowek, kosz),
// ktore w malym kafelku nie mialyby gdzie stanac ani jak byc trafione palcem.

export type TripLayout = "lista" | "siatka" | "mozaika";

const STORAGE_KEY = "spontaway_trip_layout";
const VALID: TripLayout[] = ["lista", "siatka", "mozaika"];

export function useTripLayout(): [TripLayout, (l: TripLayout) => void] {
  const [layout, setLayout] = useState<TripLayout>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY) as TripLayout | null;
      return v && VALID.includes(v) ? v : "lista";
    } catch { return "lista"; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, layout); } catch { /* prywatne okno */ }
  }, [layout]);
  return [layout, setLayout];
}

/** Kolejnosc przelaczania jednym guzikiem: lista -> mozaika -> siatka -> lista. */
const CYCLE: TripLayout[] = ["lista", "mozaika", "siatka"];
const LAYOUT_ICON: Record<TripLayout, typeof Rows3> = { lista: Rows3, mozaika: LayoutGrid, siatka: Grid3x3 };
const LAYOUT_LABEL: Record<TripLayout, string> = { lista: "layout.list", mozaika: "layout.mosaic", siatka: "layout.grid" };

/**
 * JEDEN guzik zamiast rzedu trzech (prosba Nat 2026-09-15): trzy kwadraty obok siebie
 * najezdzaly na chipy podzakladek (Opublikowane / Robocze / Zapisane) na waskim ekranie.
 * Tap przelacza uklad w kolko i od razu zmienia ikone - ikona pokazuje uklad AKTUALNY
 * (stan, nie zapowiedz), bo przy trzech pozycjach "co bedzie dalej" nie da sie odgadnac
 * z jednego symbolu. Nastepny uklad siedzi w aria-label, zeby czytnik ekranu go zapowiadal.
 */
export function TripLayoutSwitch({ value, onChange }: { value: TripLayout; onChange: (l: TripLayout) => void }) {
  const { t } = useTranslation("profiles");
  const next = CYCLE[(CYCLE.indexOf(value) + 1) % CYCLE.length];
  const Icon = LAYOUT_ICON[value];
  return (
    <button
      onClick={() => { haptics.light(); onChange(next); }}
      aria-label={t("layout.switch_aria", { next: t(LAYOUT_LABEL[next]) })}
      className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-secondary text-foreground transition-colors active:scale-90"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Mozaika = DWIE jawne kolumny flex, kafelki naprzemiennie (parzyste w lewej, nieparzyste
 * w prawej), NIE CSS multicol (`columns-2`). WebKit przy multicol gubi malowanie i trafianie
 * palcem w drugiej kolumnie, gdy w poblizu pojawia sie warstwa kompozytowana (duch
 * przeciaganego kafelka, animacja FLIP) - zlapane najpierw w ExploreGrid, potem przy
 * "przytrzymaj i przestaw" na profilu (2026-09-11). Ten sam podzial na wlasnym i publicznym
 * profilu, zeby uklad ustawiony przez usera wygladal u innych identycznie.
 */
/** Zazebienie mozaiki: DRUGA kolumna zjezdza o tyle pikseli w dol (prosba Nat 2026-09-15). */
export const MOSAIC_OFFSET = "mt-7";

export function mosaicColumns<T>(items: readonly T[]): [T[], T[]] {
  const left: T[] = [];
  const right: T[] = [];
  items.forEach((it, i) => (i % 2 === 0 ? left : right).push(it));
  return [left, right];
}

/**
 * Kafelek wyjazdu do ukladow siatki i mozaiki.
 *
 * UJEDNOLICONE PROPORCJE (prosba Nat 2026-09-15). Do tej pory mozaika pusczala zdjecie
 * w NATURALNYCH proporcjach (`h-auto`), wiec obok siebie stawaly kadry 9:16, 3:4 i panoramy -
 * kolumny rozjezdzaly sie i uklad wygladal na przypadkowy. Teraz KAZDY kafelek ma ten sam
 * kadr: 3:4 w mozaice, kwadrat w siatce, a zdjecie jest kadrowane (`object-cover`).
 * Zazebienie kolumn robi PRZESUNIECIE drugiej kolumny w dol (patrz MOSAIC_OFFSET
 * w TravelerProfile / PublicProfile), nie rozne wysokosci kafelkow.
 */
export function TripTile({ photo, title, meta, onOpen, natural }: {
  photo: string | null;
  title: string;
  meta?: string | null;
  onOpen: () => void;
  /** true = mozaika (kadr 3:4), false = kwadrat siatki. */
  natural?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className={`relative w-full overflow-hidden rounded-2xl bg-[#fcede3] text-left active:opacity-90 transition-opacity ${
        natural ? "aspect-[3/4]" : "aspect-square"
      }`}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          // Bez natywnego "podnoszenia" obrazka przez WKWebView: to ono udawalo przestawianie
          // kafelkow (zgloszenie Nat 2026-09-11) - prawdziwy gest robi useLongPressReorder.
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover [-webkit-user-drag:none] select-none"
        />
      ) : (
        <span
          className="absolute inset-0"
          style={{ display: "block" }}
        >
          <span
            aria-hidden
            className="absolute inset-0 m-auto h-1/2 w-1/2"
            style={{
              backgroundColor: "#EF9D78",
              WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
              WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
              WebkitMaskSize: "contain", maskSize: "contain",
              WebkitMaskPosition: "center", maskPosition: "center",
            }}
          />
        </span>
      )}
      {/* Gradient tylko pod tekstem - na jasnym zdjeciu sama biel bylaby nieczytelna. */}
      <span className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/75 via-black/25 to-transparent">
        <span className="block text-[13px] font-bold text-white leading-tight line-clamp-2">{title}</span>
        {meta && <span className="block text-[11px] text-white/80 leading-tight mt-0.5 line-clamp-1">{meta}</span>}
      </span>
    </button>
  );
}
