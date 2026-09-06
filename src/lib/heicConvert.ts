import i18n from "@/i18n";
// iPhone domyslnie robi zdjecia w HEIC/HEIF. Wiekszosc przegladarek (poza Safari/WebKit)
// nie potrafi zdekodowac HEIC ani wyswietlic go w <img>, wiec MUSIMY skonwertowac do JPEG
// przed uploadem - inaczej wizytowka pokaze puste miejsce zamiast zdjecia na nie-Apple
// urzadzeniach. To byl glowny bug zglaszany przez lokal ("HEIC nie dziala").
//
// Strategia dwuwarstwowa:
//  1. WebKit (natywny iOS WebView, Safari): createImageBitmap dekoduje HEIC natywnie
//     -> canvas -> JPEG. Zero zaleznosci, szybkie.
//  2. Fallback (Chrome/Firefox/Edge): dynamiczny import heic2any (libheif wasm) - ladowany
//     tylko gdy naprawde potrzebny, w osobnym chunku (nie obciaza glownego bundla).

export function isHeic(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // iOS czasem podaje pusty type albo application/octet-stream dla HEIC - sprawdz rozszerzenie.
  return /\.(heic|heif)$/i.test(file.name);
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const outName = file.name.replace(/\.(heic|heif)$/i, ".jpg") || "photo.jpg";

  // 1) Proba natywna (WebKit): createImageBitmap + canvas.
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (ctx && bitmap.width > 0) {
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (blob && blob.size > 0) {
        return new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
      }
    } else {
      bitmap.close?.();
    }
  } catch {
    // WebKit nie zdekodowal (albo to nie-WebKit przegladarka) - lecimy fallbackiem ponizej.
  }

  // 2) Fallback: heic2any (libheif). Dynamiczny import - osobny chunk.
  try {
    const mod = await import("heic2any");
    const heic2any = (mod.default ?? mod) as (opts: {
      blob: Blob; toType?: string; quality?: number;
    }) => Promise<Blob | Blob[]>;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
  } catch (err) {
    console.error("[heicConvert] konwersja HEIC nie powiodla sie:", err);
    throw new Error(i18n.t("heic.failed", { ns: "common" }));
  }
}
