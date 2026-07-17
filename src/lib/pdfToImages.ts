// Rasteryzacja PDF -> obrazy JPEG (jedna na strone). Uzywane przy uploadzie menu/cennika
// w panelu biznesowym: lokal wgrywa PDF, a my renderujemy strony na obrazy, zeby daly sie
// pokazac INLINE w wizytowce (proporcja 4:3, jak kazde inne zdjecie). Bez tego PDF byl tylko
// kafelkiem "otworz w nowej karcie" - lokal narzekal na brak podgladu.
//
// pdf.js dziala TYLKO w panelu (urzadzenie lokalu), nie w bundlu konsumenta - dlatego
// import jest dynamiczny (osobny chunk) i cala funkcja ma graceful fallback: gdy render
// sie nie powiedzie, wolajacy zostaje przy dotychczasowym zachowaniu (sam plik PDF).

const MAX_PAGES = 6;              // nie renderujemy wiecej niz 6 stron menu
const RENDER_MAX_WIDTH = 1400;    // szerokosc docelowa strony (retina-friendly, lekka)

export async function pdfToJpegFiles(file: File): Promise<File[]> {
  // Worker bundlowany przez Vite (osobny asset, ladowany relatywnie - dziala tez w
  // Capacitor WebView na file://).
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const baseName = file.name.replace(/\.pdf$/i, "") || "menu";
  const out: File[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(RENDER_MAX_WIDTH / viewport.width, 2);
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    // Biale tlo - PDF bywa transparentny, a JPEG nie ma alfy (bez tego czarne tlo).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: scaled }).promise;

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (blob && blob.size > 0) {
      out.push(new File([blob], `${baseName}-${i}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    }
  }

  doc.destroy();
  return out;
}
