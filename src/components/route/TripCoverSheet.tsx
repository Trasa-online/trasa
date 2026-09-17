import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import StoredImage from "@/components/StoredImage";
import { haptics } from "@/hooks/useHaptics";

// OKLADKA WYJAZDU W EKSPLORACJI - jeden arkusz, dwa momenty (prosba Nat 2026-09-17):
//
//  * "publish" - KAZDA publikacja przechodzi przez ten krok, takze gdy okladka jest juz
//    wybrana. Wczesniej brak okladki blokowal guzik publikacji toastem "wybierz okladke",
//    co odsylalo usera do zakladki Galeria i kazalo mu samemu wrocic. Teraz to jest krok
//    w drodze, a nie sciana - i user widzi WPROST, czym jego wyjazd bedzie sie przedstawial.
//  * "adjust" - po publikacji, spod stosu akcji. Tu mozna tez wgrac zdjecie, ktore NIE
//    trafia do galerii: okladka bywa kadrem zrobionym pod kafelek, a nie wspomnieniem.
//
// ⚠️ Okladka musi byc PIONOWA (3:4 albo 9:16, `isPortraitCover`) - kafelek w eksploracji
// kadruje do 9:16 i panorama gubi w nim polowe tresci. Walidacje robi rodzic w `onPick`,
// bo to on zna regule i pokazuje toast; arkusz tylko nie zaznacza odrzuconego zdjecia.
export default function TripCoverSheet({
  open, onOpenChange, photos, value, mode, busy, onPick, onUpload, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  photos: string[];
  value: string | null;
  mode: "publish" | "adjust";
  busy?: boolean;
  /** Sprawdza zdjecie (proporcje) i oddaje true, gdy wolno je zaznaczyc. */
  onPick: (url: string) => Promise<boolean>;
  /** Wgrywa plik i oddaje URL albo null. Tryb "publish" dorzuca go tez do galerii,
   *  "adjust" NIE - to jest wtedy zdjecie wylacznie na okladke. */
  onUpload: (file: File) => Promise<string | null>;
  onConfirm: (url: string) => void;
}) {
  const { t } = useTranslation("sharing");
  const [selected, setSelected] = useState<string | null>(value);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Przy kazdym otwarciu startujemy od AKTUALNEJ okladki - inaczej arkusz otwarty drugi raz
  // pokazywalby wybor z poprzedniego razu, ktory user mogl przeciez porzucic.
  useEffect(() => { if (open) setSelected(value); }, [open, value]);

  const pick = async (url: string) => {
    if (url === selected) return;
    if (await onPick(url)) { haptics.selection(); setSelected(url); }
  };

  const upload = async (file: File) => {
    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);
    if (url) { haptics.success(); setSelected(url); }
  };

  const empty = photos.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* ⚠️ Naglowek i guzik sa PRZYPIETE, przewija sie sama siatka. Przy wyjezdzie z
          dwudziestoma zdjeciami guzik na koncu strony oznaczalby, ze user musi przewinac cala
          galerie, zeby opublikowac - a to jest krok po drodze, nie zadanie do wykonania. */}
      <SheetContent side="bottom" className="flex max-h-[86dvh] flex-col overflow-hidden p-0">
        <div className="shrink-0 px-6 pt-6">
          <SheetHeader>
            <SheetTitle>{t(mode === "publish" ? "cover.title_publish" : "cover.title_adjust")}</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {t(mode === "publish" ? "cover.desc_publish" : "cover.desc_adjust")}
          </p>
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">

        {empty ? (
          /* STAN ZERO: wyjazd bez ani jednego zdjecia. Zamiast pustej siatki - jeden duzy
             cel, ktory od razu mowi, po co to zdjecie jest. */
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="mt-4 flex aspect-[3/4] w-full max-w-[220px] mx-auto flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground active:scale-[0.98] transition-transform disabled:opacity-60">
            {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Plus className="h-7 w-7" />}
            <span className="px-4 text-center text-[13px] font-semibold leading-snug">{t("cover.add_photo")}</span>
          </button>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {/* W trybie "dostosuj" mozna dorzucic kadr spoza galerii - stoi PIERWSZY,
                bo to jedyna rzecz, ktorej nie widac nizej. */}
            {mode === "adjust" && (
              <button onClick={() => inputRef.current?.click()} disabled={uploading}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-muted-foreground active:scale-[0.97] transition-transform disabled:opacity-60">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                <span className="px-1 text-center text-[10px] font-semibold leading-tight">{t("cover.add_own")}</span>
              </button>
            )}
            {photos.map((url) => {
              const on = url === selected;
              return (
                <button key={url} onClick={() => void pick(url)}
                  className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-muted active:scale-[0.97] transition-transform ${on ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                  <StoredImage url={url} size={300} className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary shadow-sm">
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        </div>

        <div className="shrink-0 border-t border-border/30 px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <button onClick={() => selected && onConfirm(selected)} disabled={!selected || !!busy || uploading}
            className="w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t(mode === "publish" ? "cover.confirm_publish" : "cover.confirm_adjust")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
