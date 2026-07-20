import { useState, useEffect, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import { isHeic, convertHeicToJpeg } from "@/lib/heicConvert";

// Wspolny modal kadrowania dla panelu biznesowego:
// - logo: aspect 1 + cropShape "round" (kolo, lokal skaluje/pozycjonuje znak)
// - galeria: aspect 4/3 (proporcja wizytowki, lokal decyduje jak kadr sie uklada)
// Zwraca skadrowany plik JPEG (uploadowany dalej przez uploadFile).

const MAX_OUT_WIDTH = 1600;

async function getCroppedFile(imageSrc: string, crop: Area, name: string): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const scale = Math.min(1, MAX_OUT_WIDTH / crop.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  if (!blob) throw new Error("blob");
  const outName = (name || "photo").replace(/\.(heic|heif|png|webp|jpeg|jpg)$/i, "") + ".jpg";
  return new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
}

export interface ImageCropModalProps {
  file: File;
  aspect: number;
  cropShape?: "rect" | "round";
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  // Gdy true (i cropShape='rect') - pokazuje przelacznik ukladu: poziome / pionowe / pelne zdjecie.
  allowAspectChange?: boolean;
  onCropped: (file: File) => void;
  onCancel: () => void;
}

// Uklady kadrowania. "full" = proporcja oryginalnego zdjecia (cale zdjecie, bez przycinania).
type CropLayout = "landscape" | "portrait" | "full";
const LAYOUT_ASPECT: Record<Exclude<CropLayout, "full">, number> = { landscape: 4 / 3, portrait: 3 / 4 };

export function ImageCropModal({ file, aspect, cropShape = "rect", title, confirmLabel, cancelLabel, allowAspectChange = false, onCropped, onCancel }: ImageCropModalProps) {
  const { t } = useTranslation("bizdash");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  // Wybrany uklad + proporcja oryginalu (dla "full"). Domyslnie poziome (jak dotychczas 4:3).
  const [layout, setLayout] = useState<CropLayout>("landscape");
  const [naturalAspect, setNaturalAspect] = useState(4 / 3);
  const activeAspect = !allowAspectChange
    ? aspect
    : layout === "full"
      ? naturalAspect
      : LAYOUT_ASPECT[layout];
  // Zmiana ukladu resetuje kadr/zoom, zeby nowa proporcja startowala od pelnego widoku.
  const changeLayout = (l: CropLayout) => { setLayout(l); setZoom(1); setCrop({ x: 0, y: 0 }); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let f = file;
      // HEIC (iPhone) nie wyrenderuje sie w <img> na nie-Apple - konwertuj do JPEG.
      if (isHeic(f)) { try { f = await convertHeicToJpeg(f); } catch { /* sprobuj mimo to */ } }
      const reader = new FileReader();
      reader.onload = () => { if (!cancelled) setImageSrc(reader.result as string); };
      reader.readAsDataURL(f);
    })();
    return () => { cancelled = true; };
  }, [file]);

  const onCropComplete = useCallback((_: Area, px: Area) => setAreaPixels(px), []);

  const confirm = async () => {
    if (!imageSrc || !areaPixels || busy) return;
    setBusy(true);
    try {
      onCropped(await getCroppedFile(imageSrc, areaPixels, file.name));
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={onCancel} className="text-sm font-semibold text-white/80 active:opacity-70">{cancelLabel}</button>
        <span className="text-sm font-bold text-white">{title}</span>
        <button onClick={confirm} disabled={busy || !areaPixels} className="text-sm font-bold text-blue-400 disabled:opacity-40 active:opacity-70">{busy ? "…" : confirmLabel}</button>
      </div>
      <div className="relative flex-1 min-h-0">
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={activeAspect}
            cropShape={cropShape}
            showGrid={cropShape === "rect"}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={(m) => { if (m.naturalWidth && m.naturalHeight) setNaturalAspect(m.naturalWidth / m.naturalHeight); }}
          />
        )}
      </div>
      {allowAspectChange && cropShape === "rect" && (
        <div className="px-6 pt-4 shrink-0">
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 p-1">
            {([
              { key: "landscape", label: t("crop.layout_landscape") },
              { key: "portrait", label: t("crop.layout_portrait") },
              { key: "full", label: t("crop.layout_full") },
            ] as { key: CropLayout; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => changeLayout(opt.key)}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${layout === opt.key ? "bg-white text-black" : "text-white/70 active:bg-white/10"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="px-6 py-5 flex items-center gap-3 shrink-0" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <span className="text-white/60 text-lg leading-none">-</span>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-blue-500" />
        <span className="text-white/60 text-lg leading-none">+</span>
      </div>
    </div>
  );
}

export default ImageCropModal;
