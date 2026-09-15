// Client-side image resize + recompress przed uploadem do Supabase Storage.
// Cel: znacznie zmniejszyc rozmiar plikow w storage zeby ladowaly sie szybciej.
// Przed: do 5MB raw JPG -> uploadowany do storage -> servowany jako pelen plik.
// Po: ten sam JPG po resize 1600px wide + quality 0.85 = zwykle 200-500 KB.
//
// Nie ruszamy plikow ktore juz sa male (<400 KB) lub w formacie ktorego nie da
// sie efektywnie przekompresowac z Canvas (np. niesprawdzone format).

const MAX_WIDTH = 1600; // typowy retina render-cap dla cover/gallery
const MAX_HEIGHT = 1600;
const QUALITY = 0.85;
const SKIP_THRESHOLD = 400 * 1024; // 400 KB - nizej nie ma sensu rekompresowac

/**
 * Zwraca przekompresowany File jesli udalo sie zmniejszyc, w przeciwnym razie
 * oryginalny plik. Bezpieczne w razie bledu Canvas API.
 */
export async function resizeImage(file: File): Promise<File> {
  // Skip male pliki - nie ma czego oszczedzac
  if (file.size <= SKIP_THRESHOLD) return file;
  // Skip nie-image
  if (!file.type.startsWith("image/")) return file;
  // Skip animowane GIF (canvas zniszczyloby animacje)
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width: srcW, height: srcH } = bitmap;

    // Skip male obrazy (juz wystarczajaco male wymiarowo)
    if (srcW <= MAX_WIDTH && srcH <= MAX_HEIGHT && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close?.();
      return file;
    }

    // Oblicz docelowy rozmiar zachowujac proporcje
    const scale = Math.min(MAX_WIDTH / srcW, MAX_HEIGHT / srcH, 1);
    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, dstW, dstH);
    bitmap.close?.();

    // Zdjecia zapisujemy jako WebP (~30% lzejszy od JPEG przy tej samej jakosci). Safari umie go
    // kodowac dopiero od 16.4, a starsze po cichu oddaja PNG - czyli plik CIEZSZY niz JPEG.
    // Dlatego sprawdzamy typ wyniku i przy braku wsparcia wracamy do JPEG.
    // PNG zachowujemy gdy plik zrodlowy jest PNG (logo z przezroczystoscia).
    const isPng = file.type === "image/png";
    let outputType = isPng ? "image/png" : "image/webp";
    let blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, QUALITY);
    });
    if (!isPng && (!blob || blob.type !== "image/webp")) {
      outputType = "image/jpeg";
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outputType, QUALITY);
      });
    }
    if (!blob) return file;

    // Skip jesli "skompresowane" jest wieksze niz oryginal (rzadkie, np. juz mocno skompresowane male JPG)
    if (blob.size >= file.size) return file;

    const ext = outputType === "image/png" ? ".png" : outputType === "image/webp" ? ".webp" : ".jpg";
    const newName = file.name.replace(/\.(heic|heif|webp|gif|jpe?g|png)$/i, ext);
    return new File([blob], newName, { type: outputType, lastModified: Date.now() });
  } catch (err) {
    console.warn("[imageResize] resize failed, using original file:", err);
    return file;
  }
}
