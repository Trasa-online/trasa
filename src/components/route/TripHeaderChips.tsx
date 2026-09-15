import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BrandIcon, STAR_ICON } from "@/components/BrandIcon";
import { FramedAvatar } from "@/components/profile/FramedAvatar";

// Naglowek widoku wyjazdu i listy (redesign Nat 2026-09-13, makieta "Łódzki citybreak"):
//  - autor w belce jako PIGULKA (peachy tlo, pomaranczowy @nick, awatar z ramka - nakladka
//    ma zostac, prosba Nat),
//  - pod tytulem "informacje wyhighlightowane": miasto (brazowy chip), liczba miejsc (lososiowy
//    chip z pinezka), liczba wyroznionych gwiazdka (zolty chip) - zamiast szarej linii z ikonami.
// Wspolne dla SharedRoute i SharedList, zeby oba widoki nie rozjechaly sie o piksel.

export function AuthorPill({ src, frame, color, name, onClick, className = "" }: {
  src?: string | null; frame?: string | null; color?: string | null; name: string; onClick?: () => void; className?: string;
}) {
  const inner = (
    <>
      <FramedAvatar src={src} frame={frame} color={color} size={24} />
      {/* Czarny nick (Nat 2026-09-13 - pomaranczowy z pierwszej wersji odrzucony). */}
      <span className="truncate text-[14px] font-bold text-foreground">{name}</span>
    </>
  );
  const cls = `inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-[#FCEDE3] py-1.5 pl-1.5 pr-3.5 ${className}`;
  return onClick
    ? <button onClick={onClick} className={`${cls} active:opacity-70 transition-opacity`}>{inner}</button>
    : <span className={cls}>{inner}</span>;
}

// Chip = SAM OBRYS (bez wypelnienia; makieta Nat 2026-09-13, druga iteracja): jeden szary
// obrys #D9D9D9 dla wszystkich chipow (trzecia iteracja, wieczor 2026-09-13 - kolorowe obrysy
// odrzucone), brazowy tekst i ikona W SRODKU pigulki (18 px, w linii z tekstem; wariant
// z ikona wychodzaca poza obrys odrzucony 2026-09-14).
const CHIP_STROKE = "#D9D9D9";
function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-full border-[1.5px] bg-background text-[14px] font-bold leading-none text-[#5B2C06] ${icon ? "pl-2.5 pr-3.5" : "px-3.5"}`} style={{ borderColor: CHIP_STROKE }}>
      {icon && <span aria-hidden className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{icon}</span>}
      {children}
    </span>
  );
}

/** Miasto · liczba miejsc (brandowa pinezka w brazie; "15 Miejsc" z polska odmiana, a w kolekcji
 *  "7 / 15 Miejsc" = odwiedzone / wszystkie) · wyroznione (brandowa gwiazdka w pomaranczu; chip
 *  tylko gdy > 0). Wszystkie chipy z tym samym szarym obrysem, ikony w srodku pigulki. */
export function HighlightChips({ city, placesCount, visitedCount, starredCount = 0, className = "" }: {
  city?: string | null; placesCount: number;
  /** Lista: ile z miejsc odwiedzono (moje na wlasnej liscie, autora na cudzej). Brak = sam licznik. */
  visitedCount?: number; starredCount?: number; className?: string;
}) {
  const { t } = useTranslation("routelist");
  // "15 Miejsc" - wielka litera jak w makiecie; odmiana z klucza (miejsce / miejsca / miejsc).
  const raw = t("places_count", { count: placesCount });
  const places = raw.replace(/(\d+\s*)(\S)/, (_m, num: string, ch: string) => num + ch.toUpperCase());
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {city && <Chip>{city}</Chip>}
      {/* Pinezka w brazie marki, gwiazdka w pomaranczu (prosba Nat, wieczor 2026-09-13). */}
      <Chip icon={<BrandIcon src="/Ikona_Miejsca.svg" className="h-[18px] w-[18px] text-[#5B2C06]" />}>
        {visitedCount != null ? `${visitedCount} / ${places}` : places}
      </Chip>
      {starredCount > 0 && (
        <Chip icon={<BrandIcon src={STAR_ICON} className="h-[18px] w-[18px] text-primary" />}>
          {starredCount}
        </Chip>
      )}
    </div>
  );
}
