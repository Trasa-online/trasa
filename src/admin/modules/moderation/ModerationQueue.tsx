import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, Clock, MapPin, Phone, Mail } from "lucide-react";
import { useModerationQueue, useModerate, completeness, type QueueItem, type Completeness } from "./useModeration";

const COMPLETENESS_META: Record<Completeness, { label: string; cls: string }> = {
  not_started: { label: "Brak akcji", cls: "bg-red-100 text-red-700" },
  in_progress: { label: "W trakcie", cls: "bg-amber-100 text-amber-700" },
  ready: { label: "Gotowa", cls: "bg-emerald-100 text-emerald-700" },
};

export function ModerationQueue() {
  const { data, isLoading, isError } = useModerationQueue();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Moderacja biznesów</h1>
        <p className="text-sm text-slate-500 mt-1">
          Wizytówki czekające na akcept. Cel: decyzja w&nbsp;24&nbsp;h. Najdłużej czekające na&nbsp;górze.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : isError ? (
        <p className="text-sm text-red-500 py-12 text-center">Nie udało się wczytać kolejki.</p>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-2">✅</p>
          <p className="text-slate-700 font-bold">Kolejka pusta</p>
          <p className="text-sm text-slate-500">Wszystkie wizytówki obsłużone.</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-400 mb-3">{data.length} w kolejce</p>
          <div className="space-y-3">
            {data.map((item) => <QueueCard key={item.id} item={item} />)}
          </div>
        </>
      )}
    </div>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const moderate = useModerate();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const sla = waitingLabel(item.review_requested_at ?? item.created_at);
  const comp = COMPLETENESS_META[completeness(item)];
  const img = item.cover_image_url || item.logo_url;

  const approve = () => {
    moderate.mutate({ profileId: item.id, action: "approve" }, {
      onSuccess: () => toast.success(`Zaakceptowano: ${item.business_name || "wizytówka"}`),
      onError: (e: any) => toast.error(e.message || "Błąd"),
    });
  };
  const doReject = () => {
    if (!reason.trim()) { toast.error("Podaj powód odrzucenia"); return; }
    moderate.mutate({ profileId: item.id, action: "reject", reason: reason.trim() }, {
      onSuccess: () => toast.success("Odrzucono"),
      onError: (e: any) => toast.error(e.message || "Błąd"),
    });
  };

  const busy = moderate.isPending;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex gap-4">
        <div className="h-16 w-16 rounded-xl bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
          {img
            ? <img src={img} alt="" className="h-full w-full object-cover" />
            : <span className="text-slate-300 text-xs">brak</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-slate-900 truncate">{item.business_name || <span className="text-slate-400">Bez nazwy</span>}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${comp.cls}`}>{comp.label}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${sla.over ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
                <Clock className="h-3 w-3" />{sla.text}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
            {item.main_category && <span>{item.main_category}</span>}
            {item.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.city}</span>}
            {item.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone}</span>}
            {item.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{item.email}</span>}
          </div>
          {item.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{item.description}</p>}
        </div>
      </div>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus
            placeholder="Powód odrzucenia (zobaczy go zespół w audycie)…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={doReject} disabled={busy}
              className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60">
              {busy ? "…" : "Potwierdź odrzucenie"}
            </button>
            <button onClick={() => { setRejecting(false); setReason(""); }} disabled={busy}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button onClick={approve} disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60">
            <Check className="h-4 w-4" />Akceptuj
          </button>
          <button onClick={() => setRejecting(true)} disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60">
            <X className="h-4 w-4" />Odrzuć
          </button>
        </div>
      )}
    </div>
  );
}

// Czas oczekiwania + flaga przekroczenia SLA (24h).
function waitingLabel(since: string): { text: string; over: boolean } {
  const ms = Date.now() - new Date(since).getTime();
  const h = Math.floor(ms / 3_600_000);
  const over = h >= 24;
  if (h < 1) {
    const m = Math.max(1, Math.floor(ms / 60_000));
    return { text: `${m} min`, over: false };
  }
  if (h < 48) return { text: `${h} h`, over };
  return { text: `${Math.floor(h / 24)} dni`, over: true };
}
