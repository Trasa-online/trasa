// Upload okladki (hero / miniatura) do bucketu route-images. Wspolny helper dla tras
// (ReviewSummary ma wlasny inline) i list miejsc (CreateRanking). Bucket route-images:
// public read, INSERT dla authenticated. Sciezka user-scoped: ${userId}/collections/...
import { compressImage } from "@/lib/imageCompression";
import { isHeic, convertHeicToJpeg } from "@/lib/heicConvert";
import { supabase } from "@/integrations/supabase/client";
import { Camera as CapCamera } from "@capacitor/camera";
import { uploadThumb } from "@/lib/imageThumbs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Upload jednego pliku -> public URL (albo null przy bledzie). folder = podkatalog per typ.
export async function uploadCoverImage(rawFile: File, userId: string, folder = "collections"): Promise<string | null> {
  try {
    const file = isHeic(rawFile) ? await convertHeicToJpeg(rawFile) : rawFile;
    const compressed = await compressImage(file, 1200, 1200, 0.8);
    const path = `${userId}/${folder}/cover_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
    const { error } = await supabase.storage.from("route-images").upload(path, compressed, { contentType: "image/jpeg", upsert: false });
    await uploadThumb("route-images", path, compressed);
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
