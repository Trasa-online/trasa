/**
 * Compress an image file before uploading
 * @param file The image file to compress
 * @param maxWidth Maximum width of the output image (default: 1920)
 * @param maxHeight Maximum height of the output image (default: 1920)
 * @param quality JPEG quality (0-1, default: 0.8)
 * @returns Promise with compressed Blob
 */
export const compressImage = async (
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Use better image smoothing for quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Log compression stats
            const originalSize = file.size;
            const compressedSize = blob.size;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log(
              `Image compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`
            );
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Create object URL and load image
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Compress a base64 data URL image
 * @param dataUrl Base64 data URL string
 * @param maxWidth Maximum width of the output image
 * @param maxHeight Maximum height of the output image
 * @param quality JPEG quality (0-1)
 * @returns Promise with compressed base64 data URL
 */
export const compressDataUrl = async (
  dataUrl: string,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = dataUrl;
  });
};

/**
 * Przygotowanie zdjecia do wgrania: zmniejszenie do maxSide + JPEG.
 *
 * Dlaczego osobno od compressImage (2026-09-01): tamta wersja dekoduje przez `new Image()` +
 * object URL, czyli na glownym watku i ZAWSZE w pelnej rozdzielczosci. Przy paczce zdjec z
 * iPhone'a (12 Mpx kazde) WKWebView potrafi sie tym zadlawic - `canvas.toBlob` oddaje wtedy
 * null, compressImage rzuca, a wolajacy po cichu POMIJAL zdjecie. Objaw: "wgrywanie trwa
 * wieki i finalnie nic sie nie dodaje".
 *
 * Kolejnosc prob:
 *  1. createImageBitmap - dekoduje poza glownym watkiem, wiec UI nie zamarza,
 *  2. compressImage - stara sciezka przez <img> (gdy bitmap niedostepny),
 *  3. ORYGINALNY plik - lepiej wgrac ciezsze zdjecie niz zgubic je po cichu.
 */
export async function prepareImageForUpload(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
        // Zwolnij pamiec od razu - przy paczce zdjec to roznica miedzy plynnie a zabiciem WebView.
        canvas.width = 0; canvas.height = 0;
        if (blob && blob.size > 0) return blob;
      } else {
        bitmap.close?.();
      }
    }
  } catch (e) {
    console.warn("[prepareImageForUpload] createImageBitmap:", e instanceof Error ? e.message : e);
  }
  try {
    return await compressImage(file, maxSide, maxSide, quality);
  } catch (e) {
    console.warn("[prepareImageForUpload] compressImage padl, wgrywam oryginal:", e instanceof Error ? e.message : e);
    return file;
  }
}

/** Uruchamia zadania z ograniczona rownoleglascia (domyslnie 3) - zachowuje kolejnosc wynikow. */
export async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
