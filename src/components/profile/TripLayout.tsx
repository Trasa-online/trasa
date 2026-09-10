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

export function TripLayoutSwitch({ value, onChange }: { value: TripLayout; onChange: (l: TripLayout) => void }) {
  const { t } = useTranslation("profiles");
  const opts: Array<{ id: TripLayout; icon: typeof Rows3; label: string }> = [
    { id: "lista", icon: Rows3, label: t("layout.list") },
    { id: "mozaika", icon: LayoutGrid, label: t("layout.mosaic") },
    { id: "siatka", icon: Grid3x3, label: t("layout.grid") },
  ];
  return (
    <div className="flex items-center gap-1 shrink-0">
      {opts.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => { haptics.light(); onChange(id); }}
          aria-label={label}
          aria-pressed={value === id}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors active:scale-90 ${
            value === id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/**
 * Kafelek wyjazdu do ukladow siatki i mozaiki.
 *
 * Mozaika (Pinterest) NIE udaje roznych wysokosci losowaniem - zdjecie idzie w naturalnych
 * proporcjach (`h-auto`), a uklad robia kolumny CSS. Kafelek bez zdjecia dostaje 3:4, zeby
 * nie zapadal sie do zera przed zaladowaniem.
 */
export function TripTile({ photo, title, meta, onOpen, natural }: {
  photo: string | null;
  title: string;
  meta?: string | null;
  onOpen: () => void;
  /** true = mozaika (naturalne proporcje zdjecia), false = staly kwadrat siatki. */
  natural?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className={`relative w-full overflow-hidden rounded-2xl bg-[#fcede3] text-left active:opacity-90 transition-opacity ${
        natural ? "block" : "aspect-square"
      }`}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className={natural ? "w-full h-auto block" : "absolute inset-0 w-full h-full object-cover"}
        />
      ) : (
        <span
          className={natural ? "block w-full aspect-[3/4]" : "absolute inset-0"}
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
