import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandCheck, BrandPin } from "@/components/BrandIcon";
import { haptics } from "@/hooks/useHaptics";
import { askPermission } from "@/lib/permissionPrompts";
import { getReference, setGpsReference } from "@/lib/distanceReference";

// FILTR ODLEGLOSCI w zakladce Miejsca (prosba Nat 2026-09-24: "filtrowanie po odleglosci
// miejsc ode mnie"). Dystans byl w apce od dawna - chip "2,5 km" na karcie i sortowanie
// "od najblizszego" - ale nie dalo sie powiedziec "pokaz mi TYLKO to, co mam pod reka".
//
// ⛔ Filtr NIE moze stanac nad swiperem: wysokosc karty 9:16 liczy sie ze STALEGO chrome
// (CLAUDE.md, zamrozony sizing PlaceSwiper), wiec kazdy dodatkowy wiersz zepchnalby karte
// pod dolny pasek. Dlatego wejscie to guzik w GORNEJ BELCE, a wybor - ten arkusz.
//
// ⚠️ Promien bez zgody na lokalizacje nic nie znaczy, wiec wybor sam o nia prosi - jawnie
// (`explicit`), bo to user wlasnie tapnal cos, co jej wymaga. Odmowa = zostaje "Dowolna".

/** Promienie w km. Skok jest ROSNACY (1-3-5-10-25), bo na dole skali chodzi o "tuz obok",
 *  a na gorze o "w tym miescie" - rowne kroki co 5 km daloby pol listy bez sensu. */
export const RADIUS_OPTIONS = [1, 3, 5, 10, 25] as const;

const STORAGE_KEY = "spontaway_places_radius_v1";

/** Wybrany promien przezywa wyjscie z zakladki (i restart apki) - user ustawil go swiadomie
 *  i nie chce go klikac od nowa po kazdym wejsciu w wizytowke. */
export function loadRadius(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return RADIUS_OPTIONS.includes(n as any) ? n : null;
  } catch { return null; }
}

export function saveRadius(km: number | null) {
  try {
    if (km === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(km));
  } catch { /* prywatne okno / zablokowane dane - filtr zyje wtedy tylko do wyjscia */ }
}

export default function DistanceFilterSheet({ open, onOpenChange, value, onChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Aktywny promien w km albo null = bez ograniczenia. */
  value: number | null;
  onChange: (km: number | null) => void;
}) {
  const { t } = useTranslation("plan");

  const choose = async (km: number | null) => {
    haptics.selection();
    if (km === null) { onChange(null); onOpenChange(false); return; }
    // Punkt odniesienia juz jest (GPS albo punkt startowy) - filtrujemy od razu.
    if (getReference()) { onChange(km); onOpenChange(false); return; }
    const res = await askPermission("location", "distance", { explicit: true });
    if (res !== "granted") return;          // odmowa: zostaje "Dowolna", arkusz zostaje otwarty
    await setGpsReference();
    if (!getReference()) return;            // GPS nie oddal pozycji - nie udajemy, ze filtr dziala
    onChange(km);
    onOpenChange(false);
  };

  const Row = ({ km, label }: { km: number | null; label: string }) => {
    const active = value === km;
    return (
      <button
        onClick={() => void choose(km)}
        aria-pressed={active}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-transform active:scale-[0.99] ${
          active ? "bg-[#FDF184] text-[#5B2C06]" : "bg-muted/60 text-foreground"
        }`}
      >
        <BrandPin className={`h-4 w-4 shrink-0 ${active ? "text-[#5B2C06]" : "text-muted-foreground"}`} />
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        {active && <BrandCheck className="h-4 w-4 shrink-0" />}
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        <SheetTitle className="text-lg font-black">{t("distance.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("distance.desc")}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Row km={null} label={t("distance.any")} />
          {RADIUS_OPTIONS.map((km) => (
            <Row key={km} km={km} label={t("distance.up_to_km", { km })} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
