import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, Eye, EyeOff, ChevronDown, MapPin, User } from "lucide-react";
import {
  useRankings, useModerateRanking, useToggleHidden, fetchCollectionItems, type RankingCol,
} from "../rankings/useRankings";
import { useTrips, useToggleTripHidden, fetchTripDetail, type TripCol, type TripPlace } from "./useTrips";

// Moderacja B2C: weryfikacja tresci UGC (wyjazdy + listy) - zdjecia, notki, cala
// zawartosc + nazwa autora. Reaktywna (tresc jest publiczna, admin moze ukryc/odrzucic).
export function ModerationB2CPage() {
  const [seg, setSeg] = useState<"wyjazdy" | "listy">("wyjazdy");
  const trips = useTrips();
  const lists = useRankings();
  const listsPending = (lists.data ?? []).filter((r) => r.moderation_status === "pending").length;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Moderacja B2C</h1>
        <p className="text-sm text-slate-500 mt-1">Weryfikacja treści od użytkowników: zdjęcia, notki, cała zawartość i nazwa autora.</p>
      </div>

      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1 mb-4">
        <Seg active={seg === "wyjazdy"} onClick={() => setSeg("wyjazdy")} label="Wyjazdy" n={trips.data?.length ?? 0} />
        <Seg active={seg === "listy"} onClick={() => setSeg("listy")} label="Listy" n={listsPending} accent />
      </div>

      {seg === "wyjazdy"
        ? trips.isLoading ? <Spin /> : trips.isError ? <ErrMsg /> : (trips.data?.length ?? 0) === 0
          ? <Empty text="Brak opublikowanych wyjazdów." /> : <div className="space-y-2">{trips.data!.map((t) => <TripCard key={t.id} trip={t} />)}</div>
        : lists.isLoading ? <Spin /> : lists.isError ? <ErrMsg /> : (lists.data?.length ?? 0) === 0
          ? <Empty text="Brak list." /> : <div className="space-y-2">{lists.data!.map((l) => <ListCard key={l.id} col={l} />)}</div>}
    </div>
  );
}

// ── WYJAZD ───────────────────────────────────────────────────────────────────
function TripCard({ trip }: { trip: TripCol }) {
  const toggle = useToggleTripHidden();
  const [detail, setDetail] = useState<TripPlace[] | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (detail) { setDetail(null); return; }
    setLoading(true);
    try { setDetail(await fetchTripDetail(trip.id)); } finally { setLoading(false); }
  };
  const hide = () => toggle.mutate({ id: trip.id, hidden: !trip.hidden_by_admin }, {
    onSuccess: () => toast.success(trip.hidden_by_admin ? "Przywrócono wyjazd" : "Ukryto wyjazd"),
    onError: (e: any) => toast.error(e.message || "Błąd"),
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex gap-3">
        <div className="h-16 w-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
          {trip.cover ? <img src={trip.cover} alt="" className="h-full w-full object-cover" /> : <MapPin className="h-5 w-5 text-slate-300 m-auto mt-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 truncate">{trip.title || <span className="text-slate-400">Wyjazd bez nazwy</span>}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3 text-slate-400" />{trip.author ? `@${trip.author}` : "nieznany autor"}</span>
            {trip.city && <span>{trip.city}</span>}
            <button onClick={open} className="inline-flex items-center gap-0.5 text-slate-700 font-medium">
              {trip.place_count} miejsc <ChevronDown className={`h-3 w-3 transition-transform ${detail ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        {trip.hidden_by_admin && <span className="shrink-0 h-fit px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-white">Ukryte</span>}
      </div>

      {loading && <div className="py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-300 mx-auto" /></div>}
      {detail && <PlacesPreview places={detail} />}

      <div className="flex justify-end mt-3">
        <button onClick={hide} disabled={toggle.isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[4px] text-sm font-semibold disabled:opacity-60 ${trip.hidden_by_admin ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
          {trip.hidden_by_admin ? <><Eye className="h-4 w-4" />Przywróć</> : <><EyeOff className="h-4 w-4" />Ukryj z eksploracji</>}
        </button>
      </div>
    </div>
  );
}

// ── LISTA ────────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Oczekuje", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Zaakceptowana", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Odrzucona", cls: "bg-red-100 text-red-700" },
};

function ListCard({ col }: { col: RankingCol }) {
  const moderate = useModerateRanking();
  const toggleHidden = useToggleHidden();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const st = STATUS_META[col.moderation_status] ?? STATUS_META.pending;
  const busy = moderate.isPending || toggleHidden.isPending;

  const open = async () => {
    if (items) { setItems(null); return; }
    setLoading(true);
    try { setItems(await fetchCollectionItems(col.id)); } finally { setLoading(false); }
  };
  const approve = () => moderate.mutate({ col, status: "approved" }, { onSuccess: () => toast.success("Zaakceptowano"), onError: (e: any) => toast.error(e.message) });
  const doReject = () => moderate.mutate({ col, status: "rejected", note }, { onSuccess: () => { toast.success("Odrzucono"); setRejecting(false); setNote(""); }, onError: (e: any) => toast.error(e.message) });

  // items -> format wspolny z PlacesPreview (zdjecie + notka short_desc).
  const preview: TripPlace[] = (items ?? []).map((it) => ({
    place_name: it.place_name, photos: it.photo_url ? [it.photo_url] : [],
    notes: it.short_desc?.trim() ? [{ text: it.short_desc.trim(), author: null }] : [],
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate">{col.title || <span className="text-slate-400">Bez tytułu</span>}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3 text-slate-400" />{col.author ? `@${col.author}` : "nieznany autor"}</span>
            {col.city && <span>{col.city}</span>}
            <button onClick={open} className="inline-flex items-center gap-0.5 text-slate-700 font-medium">
              {col.item_count} miejsc <ChevronDown className={`h-3 w-3 transition-transform ${items ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.cls}`}>{st.label}</span>
          {col.hidden_by_admin && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-white">Ukryta</span>}
        </div>
      </div>

      {loading && <div className="py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-300 mx-auto" /></div>}
      {items && <PlacesPreview places={preview} />}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} autoFocus placeholder="Powód odrzucenia (widoczny dla autora)…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          <div className="flex gap-2">
            <button onClick={doReject} disabled={busy} className="flex-1 py-2 rounded-[4px] bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60">{busy ? "…" : "Potwierdź odrzucenie"}</button>
            <button onClick={() => { setRejecting(false); setNote(""); }} className="px-4 py-2 rounded-[4px] bg-slate-100 text-slate-700 text-sm font-semibold">Anuluj</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          {col.moderation_status !== "approved" && (
            <button onClick={approve} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[4px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"><Check className="h-4 w-4" />Akceptuj</button>
          )}
          {col.moderation_status !== "rejected" && (
            <button onClick={() => setRejecting(true)} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[4px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60"><X className="h-4 w-4" />Odrzuć</button>
          )}
          <button onClick={() => toggleHidden.mutate({ id: col.id, hidden: !col.hidden_by_admin })} disabled={busy}
            title={col.hidden_by_admin ? "Przywróć" : "Ukryj"}
            className="px-3 py-2 rounded-[4px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-60">
            {col.hidden_by_admin ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

// Wspolny podglad miejsc: zdjecia (klik = nowa karta) + notki z autorem.
function PlacesPreview({ places }: { places: TripPlace[] }) {
  if (places.length === 0) return <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">Brak miejsc.</p></div>;
  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3 space-y-3">
      {places.map((p, i) => (
        <div key={i} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />{p.place_name}</p>
          {p.photos.length > 0 && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none">
              {p.photos.map((u, j) => (
                <a key={j} href={u} target="_blank" rel="noreferrer" className="h-16 w-16 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                  <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {p.notes.length > 0 && (
            <div className="mt-2 space-y-1">
              {p.notes.map((n, j) => (
                <p key={j} className="text-xs text-slate-600 leading-snug">
                  {n.author && <span className="font-semibold text-slate-700">@{n.author}: </span>}„{n.text}"
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Seg({ active, onClick, label, n, accent }: { active: boolean; onClick: () => void; label: string; n: number; accent?: boolean }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[4px] text-xs font-semibold transition-colors ${active ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
      {label}{n > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${accent ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{n}</span>}
    </button>
  );
}

const Spin = () => <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
const ErrMsg = () => <p className="text-sm text-red-500 py-12 text-center">Nie udało się wczytać.</p>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-400 py-12 text-center">{text}</p>;
