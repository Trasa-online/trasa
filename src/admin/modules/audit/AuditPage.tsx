import { useState } from "react";
import { format } from "date-fns";
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import { useAuditLog, useAuditFacets, PAGE, type AuditEntry, type AuditFilters } from "./useAuditLog";

// Ludzkie etykiety + akcent koloru dla znanych akcji. Nieznane -> raw string, szare.
const ACTION_META: Record<string, { label: string; tone: string }> = {
  "account.soft_delete": { label: "Usunięcie konta", tone: "bg-red-100 text-red-700" },
  "business.delete": { label: "Usunięcie wizytówki", tone: "bg-red-100 text-red-700" },
  "business.approve": { label: "Akceptacja wizytówki", tone: "bg-emerald-100 text-emerald-700" },
  "business.reject": { label: "Odrzucenie wizytówki", tone: "bg-amber-100 text-amber-700" },
  "role.grant": { label: "Nadanie roli", tone: "bg-blue-100 text-blue-700" },
  "role.revoke": { label: "Odebranie roli", tone: "bg-slate-200 text-slate-700" },
  "email.send": { label: "Wysyłka maila", tone: "bg-blue-100 text-blue-700" },
};

const TARGET_LABEL: Record<string, string> = {
  profile: "Konto",
  business_profile: "Wizytówka",
  waitlist: "Waitlista",
  route: "Plan",
  discovery_collection: "Zestawienie",
};

const actionMeta = (a: string) => ACTION_META[a] ?? { label: a, tone: "bg-slate-100 text-slate-600" };

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(0);
  const { data, isLoading, isError } = useAuditLog(filters, page);
  const { data: facets } = useAuditFacets();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const setFilter = (key: keyof AuditFilters, value: string) => {
    setPage(0);
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Dziennik audytu</h1>
        <p className="text-sm text-slate-500 mt-1">Historia operacji nieodwracalnych: kto, co i kiedy. Zapis automatyczny, tylko do odczytu.</p>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterSelect label="Akcja" value={filters.action ?? ""} onChange={(v) => setFilter("action", v)}
          options={(facets?.actions ?? []).map((a) => ({ value: a, label: actionMeta(a).label }))} />
        <FilterSelect label="Operator" value={filters.actor ?? ""} onChange={(v) => setFilter("actor", v)}
          options={(facets?.actors ?? []).map((a) => ({ value: a, label: a }))} />
        <FilterSelect label="Typ celu" value={filters.targetType ?? ""} onChange={(v) => setFilter("targetType", v)}
          options={(facets?.targetTypes ?? []).map((t) => ({ value: t, label: TARGET_LABEL[t] ?? t }))} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : isError ? (
        <p className="text-sm text-red-500 py-8 text-center">Nie udało się wczytać dziennika.</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <ScrollText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Brak wpisów pasujących do filtrów.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => <AuditRow key={e.id} entry={e} />)}
        </div>
      )}

      {/* Paginacja */}
      {total > PAGE && (
        <div className="flex items-center justify-between mt-5">
          <span className="text-xs text-slate-400">{total} wpisów · strona {page + 1}/{pages}</span>
          <div className="flex gap-2">
            <PageBtn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></PageBtn>
            <PageBtn onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}><ChevronRight className="h-4 w-4" /></PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const meta = actionMeta(entry.action);
  const hasMeta = entry.metadata && Object.keys(entry.metadata).length > 0;
  const targetLabel = TARGET_LABEL[entry.target_type] ?? entry.target_type;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.tone}`}>{meta.label}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800">
            <span className="font-semibold">{entry.actor_email ?? "nieznany operator"}</span>
            <span className="text-slate-400"> · {targetLabel}</span>
            {entry.target_id && <span className="text-slate-400"> </span>}
            {entry.target_id && <code className="text-[11px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{entry.target_id}</code>}
          </p>
          <p className="text-xs text-slate-400 mt-1">{format(new Date(entry.created_at), "dd.MM.yyyy HH:mm")}</p>
        </div>
        {hasMeta && (
          <button onClick={() => setOpen((v) => !v)} className="text-slate-400 hover:text-slate-600 p-1" title="Szczegóły">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {open && hasMeta && (
        <pre className="mt-3 text-[11px] text-slate-600 bg-slate-50 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer">
        <option value="">{label}: wszystkie</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="p-1.5 rounded-[4px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
      {children}
    </button>
  );
}
