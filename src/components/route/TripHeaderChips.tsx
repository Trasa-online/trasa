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

// Chip = SAM OBRYS (bez wypelnienia; makieta Nat 2026-09-13, druga iteracja) z brazowym tekstem
// i IKONA WYCHODZACA poza pigulke (pinezka i gwiazdka sa wieksze niz sam chip i "siedza" na jego
// lewej krawedzi). Ikona jest absolutna, wiec nie rozpycha wysokosci chipa; tekst dostaje lewy
// padding na jej szerokosc.
function Chip({ stroke, icon, children }: { stroke: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`relative inline-flex h-8 items-center rounded-full border-[1.5px] bg-background text-[14px] font-bold leading-none text-[#5B2C06] ${icon ? "pl-10 pr-3.5" : "px-3.5"}`} style={{ borderColor: stroke }}>
      {icon && <span aria-hidden className="pointer-events-none absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center">{icon}</span>}
      {children}
    </span>
  );
}

/** Miasto (brazowy obrys) · liczba miejsc (lososiowy obrys, brandowa pinezka; "15 Miejsc" z polska
 *  odmiana, a na liscie "7 / 15 Miejsc" = odwiedzone / wszystkie) · wyroznione (zolty obrys,
 *  brandowa gwiazdka; chip tylko gdy > 0). */
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
      {city && <Chip stroke="#5B2C06">{city}</Chip>}
      {/* Pinezka w kolorze #CC3434 (prosba Nat 2026-09-13). */}
      <Chip stroke="#F0A583" icon={<BrandIcon src="/Ikona_Miejsca.svg" className="h-9 w-9 text-[#CC3434]" />}>
        {visitedCount != null ? `${visitedCount} / ${places}` : places}
      </Chip>
      {starredCount > 0 && (
        <Chip stroke="#FDF184" icon={<BrandIcon src={STAR_ICON} className="h-9 w-9 text-primary" />}>
          {starredCount}
        </Chip>
      )}
    </div>
  );
}
