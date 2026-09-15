import { useState } from "react";
import { createPortal } from "react-dom";
import { X, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { previewPhoto } from "../preview/PreviewParts";
import { Button, TextArea, Spinner } from "../../ui";

// Best-effort kasowanie pliku ze Storage (dla 'usun'). Dziala tylko dla storage public URL
// (zdjecia userow). Google-proxy nie ma pliku w Storage - referencje i tak usuwa RPC.
async function purgeStorage(url: string) {
  try {
    const m = url.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/([^?]+)/);
    if (!m) return;
    await supabase.storage.from(m[1]).remove([decodeURIComponent(m[2])]);
  } catch { /* best-effort */ }
}

// Modal moderacji pojedynczego zdjecia: podglad + Ukryj / Usun z polem na powod.
// RPC admin_moderate_photo usuwa URL ze wszystkich referencji (piny + listy + place_photos),
// wiec zdjecie znika z apki od razu. 'usun' dodatkowo kasuje plik ze Storage.
export function PhotoModerationModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "hide" | "delete">(null);
  if (!url) return null;

  const act = async (action: "hide" | "delete") => {
    setBusy(action);
    try {
      const { data, error } = await (supabase as any).rpc("admin_moderate_photo", { p_url: url, p_action: action, p_reason: reason.trim() || null });
      if (error) throw error;
      if (action === "delete") await purgeStorage(url);
      const refs = (data as any)?.refs ?? 0;
      toast.success(action === "delete" ? `Usunięto zdjęcie${refs ? ` (${refs})` : ""}` : "Ukryto zdjęcie");
      qc.invalidateQueries({ queryKey: ["b2c-trips"] });
      qc.invalidateQueries({ queryKey: ["rankings"] });
      qc.invalidateQueries({ queryKey: ["admin-activity"] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Nie udało się");
    } finally { setBusy(null); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex justify-end p-4">
        <button onClick={onClose} aria-label="Zamknij" className="h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        <img src={previewPhoto(url, 1200) ?? undefined} alt="" className="rounded-[var(--r-control)] object-contain" style={{ maxHeight: "100%", maxWidth: "100%" }} />
      </div>
      <div className="p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-[min(28rem,100%)] rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <TextArea
            value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder="Powód (trafia do audytu), np. treści nieodpowiednie"
          />
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" disabled={!!busy} onClick={() => act("hide")}
              icon={busy === "hide" ? <Spinner /> : <EyeOff className="h-4 w-4" />}>
              Ukryj zdjęcie
            </Button>
            <Button variant="danger" className="flex-1" disabled={!!busy} onClick={() => act("delete")}
              icon={busy === "delete" ? <Spinner /> : <Trash2 className="h-4 w-4" />}>
              Usuń zdjęcie
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--stone)]">
            Zdjęcie zniknie z aplikacji od razu. Usunięcie kasuje też plik ze storage.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
