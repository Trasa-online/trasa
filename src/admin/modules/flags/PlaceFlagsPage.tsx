import { Loader2, Flag, Check, X, RefreshCw } from "lucide-react";
import { usePlaceFlags, useResolveFlag, useClearPhotoAndResolve, REASON_LABEL } from "./usePlaceFlags";
import { adminPhotoUrl } from "../places/usePlaces";

export function PlaceFlagsPage() {
  const flags = usePlaceFlags();
  const resolve = useResolveFlag();
  const clearPhoto = useClearPhotoAndResolve();
  const busy = resolve.isPending || clearPhoto.isPending;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Flagi miejsc</h1>
        <p className="text-sm text-slate-500 mt-1">Zgłoszenia userów o problemach z miejscem/wizytówką. Rozwiąż, odrzuć, albo (dla złego zdjęcia) wyczyść cache i pobierz ponownie.</p>
      </div>

      {flags.isLoading ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (flags.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-slate-400 py-12 text-center">Brak otwartych zgłoszeń 🎉</p>
      ) : (
        <div className="space-y-2.5">
          {flags.data!.map((f) => {
            const img = adminPhotoUrl(f.place?.photo_url);
            return (
              <div key={f.id} className="bg-white border border-slate-100 rounded-2xl p-3">
                <div className="flex items-start gap-3">
                  {img ? (
                    <img src={img} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0 bg-slate-100" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Flag className="h-5 w-5 text-slate-300" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{f.place?.place_name ?? "— (miejsce usunięte)"}</p>
                    <p className="text-xs text-slate-400 truncate">{[f.place?.address, f.place?.city].filter(Boolean).join(" · ") || "brak adresu"}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">{REASON_LABEL[f.reason] ?? f.reason}</span>
                      <span className="text-[11px] text-slate-400">{new Date(f.created_at).toLocaleDateString("pl")}</span>
                    </div>
                    {f.note && <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5">„{f.note}"</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {f.reason === "bad_photo" && (
                    <button disabled={busy} onClick={() => clearPhoto.mutate(f)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors">
                      {clearPhoto.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Wyczyść zdjęcie + re-fetch
                    </button>
                  )}
                  <button disabled={busy} onClick={() => resolve.mutate({ id: f.id, status: "resolved" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                    <Check className="h-3.5 w-3.5" /> Rozwiązane
                  </button>
                  <button disabled={busy} onClick={() => resolve.mutate({ id: f.id, status: "dismissed" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 transition-colors">
                    <X className="h-3.5 w-3.5" /> Odrzuć
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
