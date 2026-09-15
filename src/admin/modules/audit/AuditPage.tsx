// Dziennik audytu. Tylko do odczytu: kto, co, kiedy i na czym.
// Surowy payload ogladamy w ciemnym bloku konsoli - to jedyne miejsce w panelu,
// gdzie kierunek "Karta danych" dopuszcza ciemne tlo.
import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  AppShell, PageHeader, Toolbar, Select, DataTable, StatusBadge, Panel,
  type Column, type Tone,
} from "../../ui";
import { useAuditLog, useAuditFacets, PAGE, type AuditEntry, type AuditFilters } from "./useAuditLog";

// Ludzkie etykiety dla znanych akcji. Nieznana akcja zostaje surowym kluczem - lepiej
// zobaczyc `business.foo` niz zgadywac, co znaczy wyglazona nazwa.
const ACTION_META: Record<string, { label: string; tone: Tone }> = {
  "account.soft_delete": { label: "Usunięcie konta", tone: "bad" },
  "business.delete": { label: "Usunięcie wizytówki", tone: "bad" },
  "business.approve": { label: "Akceptacja wizytówki", tone: "ok" },
  "business.reject": { label: "Odrzucenie wizytówki", tone: "warn" },
  "role.grant": { label: "Nadanie roli", tone: "neutral" },
  "role.revoke": { label: "Odebranie roli", tone: "neutral" },
  "email.send": { label: "Wysyłka maila", tone: "neutral" },
};

const TARGET_LABEL: Record<string, string> = {
  profile: "Konto",
  business_profile: "Wizytówka",
  waitlist: "Waitlista",
  route: "Wyjazd",
  discovery_collection: "Kolekcja",
};

const actionMeta = (a: string) => ACTION_META[a] ?? { label: a, tone: "neutral" as Tone };
const hasMeta = (e: AuditEntry) => !!e.metadata && Object.keys(e.metadata).length > 0;

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const { data, isLoading, isError } = useAuditLog(filters, page);
  const { data: facets } = useAuditFacets();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const setFilter = (key: keyof AuditFilters, value: string) => {
    setPage(0);
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: "action", label: "Akcja", width: 210, primary: true,
      render: (e) => {
        const meta = actionMeta(e.action);
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
      },
    },
    {
      key: "actor", label: "Operator", secondary: true,
      render: (e) => <span className="truncate">{e.actor_email ?? "nieznany operator"}</span>,
    },
    {
      key: "target", label: "Cel", width: 260,
      render: (e) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0">{TARGET_LABEL[e.target_type] ?? e.target_type}</span>
          {e.target_id ? <code className="data truncate text-[11px] text-[var(--stone)]">{e.target_id}</code> : null}
        </span>
      ),
    },
    {
      key: "when", label: "Kiedy", width: 150, align: "right",
      render: (e) => <span className="data text-[var(--stone)]">{format(new Date(e.created_at), "dd.MM.yyyy HH:mm")}</span>,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Audyt"
        subtitle="Historia operacji nieodwracalnych. Zapis powstaje automatycznie i nie da się go zmienić."
      />

      <Toolbar count={total ? `${total} wpisów · strona ${page + 1} z ${pages}` : undefined}>
        <Select
          label="Akcja" value={filters.action ?? ""} onChange={(v) => setFilter("action", v)}
          options={(facets?.actions ?? []).map((a) => ({ value: a, label: actionMeta(a).label }))}
        />
        <Select
          label="Operator" value={filters.actor ?? ""} onChange={(v) => setFilter("actor", v)}
          options={(facets?.actors ?? []).map((a) => ({ value: a, label: a }))}
        />
        <Select
          label="Cel" value={filters.targetType ?? ""} onChange={(v) => setFilter("targetType", v)}
          options={(facets?.targetTypes ?? []).map((t) => ({ value: t, label: TARGET_LABEL[t] ?? t }))}
        />
      </Toolbar>

      {isError ? (
        <p className="py-12 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać dziennika.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyOf={(e) => String(e.id)}
          loading={isLoading}
          onRowClick={(e) => (hasMeta(e) ? setOpen(e) : undefined)}
          empty={{ fact: "Żaden wpis nie pasuje do filtrów.", next: "Zdejmij filtr akcji albo operatora." }}
        />
      )}

      {total > PAGE ? (
        <div className="flex items-center justify-end gap-2">
          <PageBtn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} label="Poprzednia strona">
            <ChevronLeft className="h-4 w-4" />
          </PageBtn>
          <PageBtn onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} label="Następna strona">
            <ChevronRight className="h-4 w-4" />
          </PageBtn>
        </div>
      ) : null}

      {open ? (
        <Panel
          title={actionMeta(open.action).label}
          subtitle={`${open.actor_email ?? "nieznany operator"} · ${format(new Date(open.created_at), "dd.MM.yyyy HH:mm")}`}
          onClose={() => setOpen(null)}
        >
          <pre className="data overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--r-control)] bg-[var(--console)] p-3.5 text-[12px] leading-5 text-[var(--console-ink)]">
            {JSON.stringify(open.metadata, null, 2)}
          </pre>
        </Panel>
      ) : null}
    </AppShell>
  );
}

function PageBtn({ children, onClick, disabled, label }: {
  children: React.ReactNode; onClick: () => void; disabled: boolean; label: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className="rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] p-1.5 text-[var(--graphite)] shadow-[var(--shadow-inset)] hover:bg-[var(--canvas)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
