import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, Eye, EyeOff, ChevronDown, MapPin, Plus, Star } from "lucide-react";
import {
  useRankings, useModerateRanking, useToggleHidden, fetchCollectionItems,
  useLeads, usePromoteLead, type RankingCol, type Lead,
} from "./useRankings";

export function RankingsPage() {
  const [tab, setTab] = useState<"ugc" | "leads">("ugc");
  const rankings = useRankings();
  const leads = useLeads();
  const pending = (rankings.data ?? []).filter((r) => r.moderation_status === "pending").length;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Zestawienia i leady</h1>
        <p className="text-sm text-slate-500 mt-1">Moderacja zestawień userów i dodawanie miejsc spoza bazy.</p>
      </div>

      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1 mb-4">
        <Tab active={tab === "ugc"} onClick={() => setTab("ugc")} label="Zestawienia" n={pending} accent />
        <Tab active={tab === "leads"} onClick={() => setTab("leads")} label="Leady miejsc" n={leads.data?.length ?? 0} />
      </div>

      {tab === "ugc"
        ? rankings.isLoading ? <Spin /> : rankings.isError ? <ErrMsg /> : (rankings.data?.length ?? 0) === 0
          ? <Empty text="Brak zestawień." /> : <div className="space-y-2">{rankings.data!.map((r) => <RankingCard key={r.id} col={r} />)}</div>
        : leads.isLoading ? <Spin /> : leads.isError ? <ErrMsg /> : (leads.data?.length ?? 0) === 0
          ? <Empty text="Brak leadów miejsc." /> : <div className="space-y-2">{leads.data!.map((l) => <LeadCard key={l.key} lead={l} />)}</div>}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Oczekuje", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Zaakceptowane", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Odrzucone", cls: "bg-red-100 text-red-700" },
};

function RankingCard({ col }: { col: RankingCol }) {
  const moderate = useModerateRanking();
  const toggleHidden = useToggleHidden();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<any[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const st = STATUS_META[col.moderation_status] ?? STATUS_META.pending;
  const busy = moderate.isPending || toggleHidden.isPending;

  const openPreview = async () => {
    if (preview) { setPreview(null); return; }
    setLoadingPreview(true);
    setPreview(await fetchCollectionItems(col.id));
    setLoadingPreview(false);
  };
  const approve = () => moderate.mutate({ col, status: "approved" }, { onSuccess: () => toast.success("Zaakceptowano"), onError: (e: any) => toast.error(e.message) });
  const doReject = () => moderate.mutate({ col, status: "rejected", note }, {
    onSuccess: () => { toast.success("Odrzucono"); setRejecting(false); setNote(""); }, onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate">{col.title || <span className="text-slate-400">Bez tytułu</span>}</p>
          <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
            {col.city && <span>{col.city}</span>}
            {col.author && <span>@{col.author}</span>}
            <button onClick={openPreview} className="inline-flex items-center gap-0.5 text-slate-700 font-medium">
              {col.item_count} miejsc <ChevronDown className={`h-3 w-3 transition-transform ${preview ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.cls}`}>{st.label}</span>
          {col.hidden_by_admin && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-white">Ukryte</span>}
        </div>
      </div>

      {loadingPreview && <div className="py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-300 mx-auto" /></div>}
      {preview && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 space-y-1.5">
          {preview.length === 0 ? <p className="text-xs text-slate-400">Brak miejsc.</p> : preview.map((it) => (
            <div key={it.id} className="flex items-center gap-2 text-xs text-slate-600">
              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="truncate">{it.place_name}</span>
              {!it.place_id && <span className="text-[10px] text-amber-600 shrink-0">(spoza bazy)</span>}
            </div>
          ))}
        </div>
      )}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} autoFocus placeholder="Powód odrzucenia (widoczny dla autora)…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          <div className="flex gap-2">
            <button onClick={doReject} disabled={busy} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60">{busy ? "…" : "Potwierdź odrzucenie"}</button>
            <button onClick={() => { setRejecting(false); setNote(""); }} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold">Anuluj</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          {col.moderation_status !== "approved" && (
            <button onClick={approve} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"><Check className="h-4 w-4" />Akceptuj</button>
          )}
          {col.moderation_status !== "rejected" && (
            <button onClick={() => setRejecting(true)} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60"><X className="h-4 w-4" />Odrzuć</button>
          )}
          <button onClick={() => toggleHidden.mutate({ id: col.id, hidden: !col.hidden_by_admin })} disabled={busy}
            title={col.hidden_by_admin ? "Przywróć" : "Ukryj"}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-60">
            {col.hidden_by_admin ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const promote = usePromoteLead();
  const go = () => promote.mutate(lead, {
    onSuccess: (r: any) => toast.success(r?.reused ? `Połączono z: ${r.placeName}` : `Dodano do bazy: ${r.placeName}`),
    onError: (e: any) => toast.error(e.message || "Błąd"),
  });
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-3 items-center">
      <div className="h-14 w-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
        {lead.photo_url ? <img src={lead.photo_url} alt="" className="h-full w-full object-cover" /> : <MapPin className="h-5 w-5 text-slate-300 m-auto mt-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 truncate">{lead.place_name}</p>
        <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
          {lead.city && <span>{lead.city}</span>}
          {lead.category && <span>{lead.category}</span>}
          {lead.rating != null && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-400" />{lead.rating}</span>}
          <span className="text-slate-700 font-medium">w {lead.count} zestawieniach</span>
        </div>
      </div>
      <button onClick={go} disabled={promote.isPending}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-60">
        {promote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Dodaj
      </button>
    </div>
  );
}

function Tab({ active, onClick, label, n, accent }: { active: boolean; onClick: () => void; label: string; n: number; accent?: boolean }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
      {label}{n > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${accent ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{n}</span>}
    </button>
  );
}

const Spin = () => <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
const ErrMsg = () => <p className="text-sm text-red-500 py-12 text-center">Nie udało się wczytać.</p>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-400 py-12 text-center">{text}</p>;
