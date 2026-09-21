import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Download } from "lucide-react";
import { toast } from "sonner";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { haptics } from "@/hooks/useHaptics";
import { drawSticker, stickerSize, ensureStickerFont, stickerPng, stickerGif, type StickerVariant } from "@/lib/placeSticker";
import { deliverShareImage } from "@/lib/shareImage";
import { isNative } from "@/lib/platform";

// NAKLADKA MIEJSCA (prosba Nat 2026-09-21): panel nad arkuszem udostepniania wizytowki.
// Podglad = ten sam `drawSticker`, ktory produkuje plik - na zywo (rAF) w trybie animowanym,
// jedna klatka w statycznym. Pobranie: PNG (statyczna) albo GIF (gwiazdki sie ruszaja,
// handle stoi), oba z przezroczystym tlem, przez systemowy arkusz (natywka) / pobranie (web).
//
// Panel jest reczny (fixed, z-[97]), nie `Sheet` z shadcn: arkusz udostepniania stoi na
// z-[95], a `SheetContent` ma z-50 i schowalby sie pod nim. Gest w dol z `useDragToDismiss`.
export default function PlaceStickerSheet({ open, handle, placeName, onClose }: {
  open: boolean;
  handle: string;
  placeName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("sharing");
  const [mode, setMode] = useState<"static" | "animated">("animated");
  // "full" = gwiazdki + pigulka na cala relacje; "pill" = sama zolta naklejka z handle (bez
  // gwiazdek, wiec tylko PNG - nie ma czego animowac).
  const [variant, setVariant] = useState<StickerVariant>("full");
  const animated = variant === "full" && mode === "animated";
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { dragProps } = useDragToDismiss({ onDismiss: onClose, enabled: open && !busy });

  // Podglad: canvas w rozmiarze logicznym nakladki, skalowany CSS-em do szerokosci panelu.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let stop = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    (async () => {
      await ensureStickerFont();
      if (stop) return;
      const { w, h } = stickerSize(handle, variant);
      const dpr = variant === "pill" ? 3 : Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.aspectRatio = `${w} / ${h}`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t0 = performance.now();
      const tick = () => {
        if (stop) return;
        const t = animated ? ((performance.now() - t0) % 1800) / 1800 : 0;
        drawSticker(ctx, handle, t, { animated, variant });
        if (animated) raf = requestAnimationFrame(tick);
      };
      tick();
    })();
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [open, handle, variant, animated]);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    haptics.light();
    const id = toast.loading(t("sticker.preparing"));
    try {
      const slug = handle.replace(/[^a-z0-9]/gi, "").toLowerCase() || "miejsce";
      const blob = !animated
        ? await stickerPng(handle, variant)
        : await stickerGif(handle, { onProgress: (d, n) => { if (d % 6 === 0) toast.loading(t("sticker.preparing_frames", { done: d, total: n }), { id }); } });
      toast.dismiss(id);
      if (isNative) toast(t("share.image_hint_save"));
      const suffix = variant === "pill" ? "naklejka" : "nakladka";
      const res = await deliverShareImage(blob, `spontaway-${slug}-${suffix}.${animated ? "gif" : "png"}`, { title: placeName, kind: "place", channel: variant === "pill" ? "sticker_pill" : animated ? "sticker_gif" : "sticker_png" });
      if (res === "failed") toast.error(t("share.image_failed"));
      else if (res === "downloaded") toast.success(t("share.image_downloaded"));
    } catch (e) {
      console.warn("[PlaceStickerSheet]", (e as any)?.message ?? e);
      toast.dismiss(id);
      toast.error(t("share.image_failed"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div data-vaul-no-drag data-no-drag className="fixed inset-0 z-[97] flex items-end justify-center bg-black/35 animate-in fade-in duration-150" onClick={onClose}>
      <div {...dragProps} onClick={(e) => e.stopPropagation()}
        className="w-[calc(100%-16px)] max-w-lg mx-2 mb-2 rounded-[40px] bg-background px-6 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-xl animate-in slide-in-from-bottom duration-250"
        style={{ ...dragProps.style }}>
        <div className="flex items-center justify-between">
          <p className="font-brand text-[22px] leading-none text-spontaway-orange">{t("sticker.title")}</p>
          <button onClick={onClose} aria-label={t("common:buttons.close")} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground leading-snug">{t("sticker.desc")}</p>

        {/* Podglad na szarym tle (jak wlepki na windzie z referencji) - przezroczystosc widac. */}
        {/* Podglad calej relacji 9:16 na ciemnym tle - widac przezroczystosc i uklad wlepek. */}
        <div className="mt-4 rounded-3xl bg-[#3A3A3E] p-3 flex items-center justify-center min-h-[200px]">
          <canvas ref={canvasRef} className={variant === "pill" ? "w-[80%] h-auto" : "h-[36dvh] w-auto rounded-2xl bg-[#6B6B70]"} />
        </div>

        {/* Co pobrac: caly zestaw na relacje albo sama zolta naklejka z handle (bez gwiazdek). */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["full", "pill"] as const).map((v) => (
            <button key={v} onClick={() => { haptics.selection(); setVariant(v); }}
              className={`h-10 rounded-full text-sm font-bold transition-colors ${variant === v ? "bg-spontaway-yellow text-spontaway-brown" : "text-muted-foreground"}`}>
              {t(v === "full" ? "sticker.variant_full" : "sticker.variant_pill")}
            </button>
          ))}
        </div>
        {variant === "full" && (
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {(["static", "animated"] as const).map((m) => (
              <button key={m} onClick={() => { haptics.selection(); setMode(m); }}
                className={`h-10 rounded-full text-sm font-bold transition-colors ${mode === m ? "bg-spontaway-yellow text-spontaway-brown" : "text-muted-foreground"}`}>
                {t(m === "static" ? "sticker.mode_static" : "sticker.mode_animated")}
              </button>
            ))}
          </div>
        )}

        <button onClick={() => void download()} disabled={busy}
          className="mt-3 w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
          <Download className="h-4 w-4" strokeWidth={2.4} />
          {t(animated ? "sticker.download_gif" : "sticker.download_png")}
        </button>
      </div>
    </div>
  );
}
