import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Pencil, Trash2, Check, X, Eye, EyeOff } from "lucide-react";
import { useAllBusinesses, useEditBusiness, useDeleteBusiness, type BizRow } from "./useAllBusinesses";
import { RequireTier } from "../../RequireTier";

const STATUS_CLS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
};

export function AllBusinesses() {
  const { data, isLoading, isError } = useAllBusinesses();
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((b) => !q || (b.business_name || "").toLowerCase().includes(q) || (b.city || "").toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div>
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 mb-4">
        <Search className="h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj wizytówki…" className="flex-1 bg-transparent text-sm outline-none text-slate-900" />
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        : isError ? <p className="text-sm text-red-500 py-10 text-center">Nie udało się wczytać.</p>
        : shown.length === 0 ? <p className="text-sm text-slate-400 py-10 text-center">Brak wizytówek.</p>
        : <div className="space-y-2">{shown.map((b) => <BizCard key={b.id} biz={b} />)}</div>}
    </div>
  );
}

function BizCard({ biz }: { biz: BizRow }) {
  const edit = useEditBusiness();
  const del = useDeleteBusiness();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ business_name: biz.business_name ?? "", main_category: biz.main_category ?? "", city: biz.city ?? "" });

  const save = () => edit.mutate({ id: biz.id, patch: form }, {
    onSuccess: () => { toast.success("Zapisano"); setEditing(false); }, onError: (e: any) => toast.error(e.message),
  });
  const togglePublish = () => edit.mutate({ id: biz.id, patch: { is_active: !biz.is_active } }, {
    onSuccess: () => toast.success(biz.is_active ? "Ukryto (offline)" : "Opublikowano"), onError: (e: any) => toast.error(e.message),
  });
  const doDelete = () => {
    if (!reason.trim()) { toast.error("Podaj powód"); return; }
    del.mutate({ profileId: biz.id, reason: reason.trim() }, {
      onSuccess: () => toast.success("Wizytówka usunięta"), onError: (e: any) => toast.error(e.message),
    });
  };
  const busy = edit.isPending || del.isPending;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      {editing ? (
        <div className="space-y-2">
          <Field label="Nazwa" value={form.business_name} onChange={(v) => setForm((f) => ({ ...f, business_name: v }))} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kategoria" value={form.main_category} onChange={(v) => setForm((f) => ({ ...f, main_category: v }))} />
            <Field label="Miasto" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-60"><Check className="h-4 w-4" />Zapisz</button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-[4px] bg-slate-100 text-slate-700 text-sm font-semibold">Anuluj</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{biz.business_name || <span className="text-slate-400">Bez nazwy</span>}</p>
              <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                {biz.main_category && <span>{biz.main_category}</span>}
                {biz.city && <span>{biz.city}</span>}
                {!biz.owner_user_id && <span className="text-slate-400">bez właściciela</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_CLS[biz.moderation_status] ?? "bg-slate-100 text-slate-600"}`}>{biz.moderation_status}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${biz.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{biz.is_active ? "live" : "offline"}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setEditing(true)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60"><Pencil className="h-3.5 w-3.5" />Edytuj</button>
            <button onClick={togglePublish} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60">
              {biz.is_active ? <><EyeOff className="h-3.5 w-3.5" />Ukryj</> : <><Eye className="h-3.5 w-3.5" />Publikuj</>}
            </button>
            <RequireTier tier="super_admin">
              <button onClick={() => setConfirmDel((v) => !v)} disabled={busy} className="ml-auto p-1.5 rounded-[4px] text-slate-400 hover:text-red-600 hover:bg-red-50" title="Usuń"><Trash2 className="h-4 w-4" /></button>
            </RequireTier>
          </div>
          {confirmDel && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Powód usunięcia (audyt)…"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400" />
              <div className="flex gap-2">
                <button onClick={doDelete} disabled={busy} className="px-4 py-2 rounded-[4px] bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60">{busy ? "…" : "Usuń"}</button>
                <button onClick={() => { setConfirmDel(false); setReason(""); }} className="px-3 py-2 rounded-[4px] bg-slate-100 text-slate-700 text-sm font-semibold">Anuluj</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400" />
    </div>
  );
}
