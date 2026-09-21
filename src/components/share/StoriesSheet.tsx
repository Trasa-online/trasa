import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { haptics } from "@/hooks/useHaptics";
import { drawStoryPreview, ensureStickerFont, STICKER_VARIANTS, type StickerVariant } from "@/lib/placeSticker";

// PANEL PRZED PRZELACZENIEM DO INSTAGRAM STORIES (2026-09-21). Dwie rzeczy w jednym:
//  1. dla MIEJSCA - wybor zestawu nakladki (trzy miniatury relacji: gwiazdki + nazwa / inny
//     uklad gwiazdek / sama nazwa), rysowane tym samym `drawOverlay`, ktory produkuje naklejke,
//     na zdjeciu miejsca albo gradiencie marki - to, co user wybierze, laduje w edytorze 1:1;
//  2. instruktaz „link jest w schowku - dodaj naklejke Link i wklej" z guzikiem „Nie pokazuj
//     wiecej" (prosba Nat). Po schowaniu instruktazu panel dla planu / kolekcji nie pokazuje sie
//     wcale (nie ma czego wybierac), a dla miejsca zostaje sam wybor zestawu.
// Panel reczny z-[97] - `Sheet` z shadcn (z-50) schowalby sie pod arkuszem
// udostepniania na z-[95].
export const STORIES_HINT_DISMISSED = "spontaway_ig_stories_hint_dismissed_v1";
export const storiesHintDismissed = () => { try { return localStorage.getItem(STORIES_HINT_DISMISSED) === "1"; } catch { return false; } };

const THUMB_W = 72, THUMB_H = 128; // 9:16, cztery obok siebie na 393 px

export default function StoriesSheet({ handle, photo, onGo, onSkip }: {
  /** Miejsce: handle na nakladce -> pokazujemy wybor zestawu. Plan / kolekcja: brak. */
  handle?: string;
  photo?: string | null;
  onGo: (variant: StickerVariant) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation("sharing");
  const [variant, setVariant] = useState<StickerVariant>("full");
  const [hint, setHint] = useState(() => !storiesHintDismissed());
  const canvases = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    if (!handle) return;
    let stop = false;
    (async () => {
      await ensureStickerFont();
      let img: HTMLImageElement | null = null;
      if (photo) {
        img = await new Promise<HTMLImageElement | null>((resolve) => {
          const i = new Image();
          i.crossOrigin = "anonymous";
          i.onload = () => resolve(i);
          i.onerror = () => resolve(null);
          i.src = photo;
        });
      }
      if (stop) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      for (const v of STICKER_VARIANTS) {
        const c = canvases.current[v];
        if (!c) continue;
        c.width = THUMB_W * dpr; c.height = THUMB_H * dpr;
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawStoryPreview(ctx, handle, v, img, THUMB_W, THUMB_H);
      }
    })();
    return () => { stop = true; };
  }, [handle, photo]);

  const dismissHint = () => { try { localStorage.setItem(STORIES_HINT_DISMISSED, "1"); } catch { /* prywatny tryb */ } setHint(false); };

  return (
    <div data-vaul-no-drag data-no-drag className="fixed inset-0 z-[97] flex items-end justify-center bg-black/40 animate-in fade-in duration-200" onClick={onSkip}>
      <div className="w-[calc(100%-16px)] max-w-lg mx-2 mb-2 rounded-[40px] bg-[#FEFEFE] px-6 pt-7 pb-[max(20px,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}>
        <p className="text-center font-brand text-[24px] leading-tight text-spontaway-orange">{t("share.stories_primer_title")}</p>

        {handle && (
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {STICKER_VARIANTS.map((v) => (
              <button key={v} onClick={() => { haptics.selection(); setVariant(v); }} className="flex flex-col items-center gap-1.5">
                <span className={`overflow-hidden rounded-2xl ring-[3px] transition-all ${variant === v ? "ring-[#5B2C06]" : "ring-transparent"}`}>
                  <canvas ref={(el) => { canvases.current[v] = el; }} style={{ width: THUMB_W, height: THUMB_H }} className="block bg-[#FDF184]" />
                </span>
                <span className={`text-[11px] font-semibold leading-tight text-center ${variant === v ? "text-[#5B2C06]" : "text-muted-foreground"}`}>{t(`sticker.variant_${v}`)}</span>
              </button>
            ))}
          </div>
        )}

        {hint && (
          <div className="mt-4 rounded-3xl bg-[#FDF184]/60 px-4 py-3">
            <ol className="space-y-2">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-start gap-3 text-[14px] leading-snug text-[#5B2C06]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#5B2C06]">{n}</span>
                  <span>{t(`share.stories_primer_step${n}`)}</span>
                </li>
              ))}
            </ol>
            <button onClick={dismissHint} className="mt-2 text-[13px] font-semibold text-[#5B2C06]/70 underline underline-offset-2">
              {t("share.stories_primer_dismiss")}
            </button>
          </div>
        )}

        <button onClick={() => onGo(variant)} className="mt-5 h-12 w-full rounded-full bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform">
          {t("share.stories_primer_go")}
        </button>
        <button onClick={onSkip} className="mt-2 h-12 w-full rounded-full bg-secondary text-secondary-foreground font-semibold active:scale-[0.98] transition-transform">
          {t("share.stories_primer_skip")}
        </button>
      </div>
    </div>
  );
}
