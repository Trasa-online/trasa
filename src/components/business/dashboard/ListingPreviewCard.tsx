// Podglad karty lokalu: „Tak widzą Cię goście".
//
// ⚠️ Ta karta ma byc 1:1 z tym, co apka rysuje w zakladce Miejsca (`SwipeCard`, tryb
// przewijania): proporcja 9:16, plakietka kategorii w lewym gornym rogu, na dole nazwa,
// adres i pigulka wydarzenia, a po prawej kolumna akcji (zapisz + rozwin) w bialych kolkach.
// Kazda roznica miedzy tym podgladem a karta w apce to obietnica, ktorej panel nie dotrzymuje.
//
// ⛔ Bez oceny i bez gwiazdek. Poprzedni podglad rysowal „4.6" na sztywno - liczbe, ktorej
// nigdzie nie ma, na produkcie, ktory z zalozenia nie ma ocen miejsc (CLAUDE.md).
import { useTranslation } from "react-i18next";
import { MapPin, ChevronUp } from "lucide-react";
import { BrandBookmark } from "@/components/BrandBookmark";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { getMainCategoryFor, mainCategoryLabel, subcategoryLabelLocalized } from "@/lib/categories";

// Te same kolory plakietki, co w karcie w aplikacji (PlaceSwiper.MAIN_CATEGORY_COLORS).
const MAIN_CATEGORY_COLORS: Record<string, string> = {
  food: "bg-orange-500/80 text-white",
  culture: "bg-violet-600/80 text-white",
  attractions: "bg-teal-600/80 text-white",
  nature: "bg-emerald-600/80 text-white",
};

export interface ListingPreviewCardProps {
  coverImageUrl?: string | null;
  coverVideoUrl?: string | null;
  logoUrl?: string | null;
  businessName: string;
  mainCategory?: string | null;
  subcategories?: string[];
  street?: string | null;
  city?: string | null;
  eventTitle?: string | null;
  tags?: string[];
}

export function ListingPreviewCard(props: ListingPreviewCardProps) {
  const { t } = useTranslation("bizdash");

  const subId = props.subcategories?.[0] ?? null;
  // Plakietka pokazuje PODKATEGORIE, gdy jest (gosc szuka „Kawiarni", nie „Jedzenia & Napojów").
  const badgeLabel = subId ? subcategoryLabelLocalized(subId) : props.mainCategory ? mainCategoryLabel(props.mainCategory) : null;
  const mainId = props.mainCategory ?? (subId ? getMainCategoryFor(subId)?.id : null);
  const badgeColor = (mainId && MAIN_CATEGORY_COLORS[mainId]) || "bg-slate-500/80 text-white";

  const hasMedia = !!(props.coverImageUrl || props.coverVideoUrl);
  const meta = [props.street, props.city].filter(Boolean).join(", ");
  const tags = (props.tags ?? []).slice(0, 3);

  return (
    <div className="relative aspect-[9/16] w-full select-none overflow-hidden rounded-3xl bg-[#fcede3] shadow-md">
      {props.coverVideoUrl ? (
        <video src={props.coverVideoUrl} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : props.coverImageUrl ? (
        <img src={props.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        // Stan zero jest taki sam jak w apce: ikona kategorii na peachowym tle, zero emoji.
        <div className="absolute inset-0 flex items-center justify-center">
          <img src={categoryIconSrc(subId ?? props.mainCategory)} alt="" className="h-16 w-16 opacity-90" />
        </div>
      )}

      <div className={`absolute inset-0 ${hasMedia
        ? "bg-gradient-to-t from-black/90 via-black/40 to-black/10"
        : "bg-gradient-to-t from-black/55 via-transparent to-transparent"}`} />

      {badgeLabel ? (
        <div className="absolute left-4 top-4 z-10">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold shadow-sm ${badgeColor}`}>{badgeLabel}</span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 space-y-2 px-5 pb-7 pr-[72px] pt-5">
        {props.logoUrl ? (
          <div className="h-10 w-10 overflow-hidden rounded-full border border-white/30 bg-white/10 shadow-md">
            <img src={props.logoUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}

        <h2 className="text-2xl font-black leading-tight text-white">
          {props.businessName || t("business_name_fallback")}
        </h2>

        {meta ? (
          <div className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-white/50" />
            <span className="truncate text-xs text-white/60">{meta}</span>
          </div>
        ) : null}

        {props.eventTitle ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] px-2.5 py-0.5 text-xs font-semibold text-white">
            {props.eventTitle}
          </div>
        ) : null}

        {tags.length ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Kolumna akcji 1:1 z karta w apce: zapisz (brandowa zakladka) + rozwin. */}
      <div className="absolute bottom-4 right-3 z-20 flex flex-col gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg">
          <BrandBookmark filled={false} className="h-5 w-5 text-foreground" />
        </span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg">
          <ChevronUp className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}
