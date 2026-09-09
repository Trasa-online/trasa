// Upload okladki (hero / miniatura) do bucketu route-images. Wspolny helper dla tras
// (ReviewSummary ma wlasny inline) i list miejsc (CreateRanking). Bucket route-images:
// public read, INSERT dla authenticated. Sciezka user-scoped: ${userId}/collections/...
import { supabase } from "@/integrations/supabase/client";
import { Camera as CapCamera } from "@capacitor/camera";
import { renderForUpload, uploadPair } from "@/lib/imageThumbs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Upload jednego pliku -> public URL (albo null przy bledzie). folder = podkatalog per typ.
export async function uploadCoverImage(rawFile: File, userId: string, folder = "collections"): Promise<string | null> {
  try {
    // Jedno dekodowanie na okladke + miniatura z tej samej bitmapy, oba wyslania rownolegle.
    // Wczesniej bylo tu `compressImage` (dekodowanie przez <img> i pelny canvas) ORAZ osobny
    // `uploadThumb`, ktory dekodowal zdjecie DRUGI raz i szedl po wyslaniu oryginalu.
    const path = `${userId}/${folder}/cover_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
    const { full, thumb } = await renderForUpload(rawFile);
    const { error } = await uploadPair("route-images", path, full, thumb);
    if (error) { console.error("[coverUpload] upload failed:", error.message); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`;
  } catch (err: any) {
    console.error("[coverUpload] processing failed:", err?.message ?? err);
    return null;
  }
}

// Native picker -> lista File (1:1 z ReviewSummary.pickNativeImageFiles).
export async function pickNativeCoverFiles(limit: number): Promise<File[]> {
  const result = await CapCamera.pickImages({ quality: 90, limit, width: 1200, height: 1200 });
  const files: File[] = [];
  for (const photo of result.photos) {
    if (!photo.webPath) continue;
    try {
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const fmt = photo.format || "jpeg";
      const mime = fmt === "png" ? "image/png" : "image/jpeg";
      files.push(new File([blob], `cover-${Date.now()}-${files.length}.${fmt}`, { type: mime }));
    } catch { /* skip */ }
  }
  return files;
}
