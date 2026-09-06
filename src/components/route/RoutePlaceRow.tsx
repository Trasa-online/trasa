import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { localizeTag } from "@/lib/routeTags";
import { Bookmark, Trash2 } from "lucide-react";
import { PlacePhoto } from "@/components/PlacePhoto";
import { avatarSrc } from "@/lib/avatar";

// Oficjalne logo Google (4-kolorowe "G") - guzik "otworz miejsce w Google Maps".
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
export function RoutePlaceRow({ pin, index, categoryLabel, onOpen, onGoogle, onSave, saved, onDelete, dragHandle, note, cornerAvatar }: {
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
}) {
  const { t } = useTranslation("route");
  return (
    <div className="bg-background py-4 border-b border-border/70 last:border-b-0">
      {/* Zdjecie + tresc (nazwa, notki, tagi) */}
      <div className="flex gap-3">
        {dragHandle}
        {/* Peachy kafelek ikony/zdjecia - PIONOWY prostokat 2:3 (redesign 2026-08-25, spojne z okladkami
            miniaturek/kart). self-start: przyklejony do gory wiersza. */}
        <button onClick={onOpen} className="relative w-16 h-24 shrink-0 self-start rounded-2xl overflow-hidden bg-[#fcede3] active:opacity-90">
          <PlacePhoto pin={pin} width={80} className="w-full h-full object-cover" />
          {cornerAvatar !== undefined && (
            <img src={avatarSrc(cornerAvatar)} alt="" className="absolute bottom-1 right-1 h-7 w-7 rounded-full object-cover border-2 border-white shadow-sm bg-secondary" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {/* Nazwa + badge kategorii (peachy pill po prawej) */}
          <div className="flex items-start justify-between gap-2">
            <button onClick={onOpen} className="text-left min-w-0 flex-1">
              <p className="text-[16px] font-bold leading-snug line-clamp-2">{pin.place_name}</p>
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
      <div className="mt-3 flex items-center justify-end gap-2">
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
        {onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            aria-label={saved ? t("row.saved_in_list") : "Zapisz miejsce do listy"}
            className="h-9 w-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <Bookmark className={`h-5 w-5 ${saved ? "text-[#F0A583] fill-[#F0A583]" : "text-foreground/70"}`} strokeWidth={2} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={t("row.remove")}
            className="h-9 w-9 rounded-full flex items-center justify-center text-destructive active:scale-90 transition-transform"
          >
            <Trash2 className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
