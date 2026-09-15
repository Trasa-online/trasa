// Podglad karty lokalu: „Tak widzą Cię goście".
//
// ⛔ Ta karta NIE pokazuje oceny. Poprzedni podglad rysowal gwiazdke i „4.6" na sztywno -
// liczbe, ktorej nigdzie nie ma, na produkcie, ktory z zalozenia nie ma ocen miejsc
// (CLAUDE.md: zakaz ocen gwiazdkowych). Lokal patrzyl na podglad i widzial obietnice,
// ktorej aplikacja nie spelnia.
//
// Pokazujemy to, co karta w apce naprawde niesie: zdjecie, kategorie, nazwe, miasto
// i godzine zamkniecia na dzis.
import { useTranslation } from "react-i18next";
import { ImageOff } from "lucide-react";
import { mainCategoryLabel, subcategoryLabelLocalized } from "@/lib/categories";
import { weekdayKeyFromDate, type OpeningHours } from "@/lib/openingHours";

export interface ListingPreviewCardProps {
  coverImageUrl?: string | null;
  coverVideoUrl?: string | null;
  businessName: string;
  mainCategory?: string | null;
  subcategories?: string[];
  city?: string | null;
  openingHours?: OpeningHours | null;
  eventTitle?: string | null;
}

export function ListingPreviewCard(props: ListingPreviewCardProps) {
  const { t } = useTranslation("bizdash");

  // Pigulka kategorii pokazuje PODKATEGORIE, gdy jest (goscia interesuje „Kawiarnia",
  // nie „Jedzenie & Napoje"), a kategorie glowna dopiero w drugiej kolejnosci.
  const badge = props.subcategories?.length
    ? subcategoryLabelLocalized(props.subcategories[0])
    : props.mainCategory
      ? mainCategoryLabel(props.mainCategory)
      : null;

  const closing = closingToday(props.openingHours ?? null);
  const meta = [props.city, closing ? t("profile.preview_open_until", { time: closing }) : null]
    .filter(Boolean).join(" · ");

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-900">
      {props.coverVideoUrl ? (
        <video src={props.coverVideoUrl} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : props.coverImageUrl ? (
        <img src={props.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
          <ImageOff className="h-6 w-6" />
          <p className="px-6 text-center text-[12px]">{t("profile.preview_no_cover")}</p>
        </div>
      )}

      {(props.coverImageUrl || props.coverVideoUrl) ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      ) : null}

      {badge ? (
        <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white">
          {badge}
        </span>
      ) : null}

      {props.eventTitle ? (
        <span className="absolute right-3 top-3 max-w-[55%] truncate rounded-full bg-[#FDF184] px-2.5 py-1 text-[11px] font-bold text-[#5B2C06]">
          {props.eventTitle}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className={`text-[18px] font-black leading-tight ${props.coverImageUrl || props.coverVideoUrl ? "text-white" : "text-slate-900"}`}>
          {props.businessName || t("business_name_fallback")}
        </p>
        {meta ? (
          <p className={`mt-0.5 text-[13px] ${props.coverImageUrl || props.coverVideoUrl ? "text-white/80" : "text-slate-500"}`}>
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Godzina zamkniecia NA DZIS - to jedyna informacja z godzin otwarcia, ktora miesci sie
// na karcie, i jedyna, o ktora gosc naprawde pyta („zdaze jeszcze?").
function closingToday(hours: OpeningHours | null): string | null {
  if (!hours) return null;
  const day = hours[weekdayKeyFromDate(new Date())];
  if (!day || "closed" in day) return null;
  return day.close || null;
}
