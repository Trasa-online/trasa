import { useTranslation } from "react-i18next";
// Szkielet ladowania W ARKUSZU / SZUFLADZIE - odpowiednik ScreenSkeleton dla tresci, ktora
// laduje sie w bottom sheecie (zapraszanie znajomych, propozycje, powiadomienia, tworzenie).
//
// Zastepuje szary napis "Ładowanie..." (zgloszenie Nat 2026-09-01: "nie ma zadnej animacji,
// jest szary i niewidoczny"). Napis mial trzy wady naraz: nie ruszal sie, wiec nie dalo sie
// odroznic ladowania od pustego stanu; nie sugerowal, co sie pojawi, wiec uklad skakal po
// zaladowaniu; i ginal na bialym tle.
//
// Zasada ta sama co w ScreenSkeleton: same bloki `bg-muted` + `animate-pulse`, zero tekstu
// i zero ikon - szkielet ma sugerowac uklad, nie udawac tresci. Wyjatek: malutki znak
// spontaway pod blokami, w peachowym #EDD9CD. To akcent marki przeniesiony z ekranu
// startowego (wariant C eksploracji), swiadomie za cichy, zeby nie odciagac uwagi.

export type SheetSkeletonVariant = "people" | "places" | "notifications";

const Block = ({ className }: { className: string }) => (
  <div className={`bg-muted rounded-2xl ${className}`} />
);

// Wiersz: kolko (awatar/miniatura) + dwie linie + opcjonalny blok akcji po prawej.
function Row({ round, action }: { round?: boolean; action?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Block className={`h-11 w-11 shrink-0 ${round ? "rounded-full" : "rounded-xl"}`} />
      <div className="flex-1 min-w-0 space-y-2">
        <Block className="h-3.5 w-2/3 rounded-full" />
        <Block className="h-3 w-1/3 rounded-full" />
      </div>
      {action && <Block className="h-8 w-20 shrink-0 rounded-full" />}
    </div>
  );
}

/**
 * @param rows ile wierszy narysowac. Domyslnie 4 - tyle, ile zwykle miesci sie w arkuszu
 *             bez przewijania, wiec szkielet konczy sie tam, gdzie skonczy sie tresc.
 */
export default function SheetSkeleton({ variant = "people", rows = 4, className }: {
  variant?: SheetSkeletonVariant;
  rows?: number;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const round = variant !== "places";
  const action = variant === "people";
  return (
    <div className={`animate-pulse ${className ?? ""}`} aria-busy="true" aria-label={t("loading")}>
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i} round={round} action={action} />
      ))}
      {/* Znak spontaway jako cichy podpis - ta sama rola co na ekranie startowym. */}
      <span
        aria-hidden
        className="mx-auto mt-4 mb-1 block h-5 w-5"
        style={{
          backgroundColor: "#EDD9CD",
          WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
          WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          WebkitMaskSize: "contain", maskSize: "contain",
          WebkitMaskPosition: "center", maskPosition: "center",
        }}
      />
    </div>
  );
}
