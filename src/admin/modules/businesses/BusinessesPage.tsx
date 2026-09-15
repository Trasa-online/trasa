// Wszystkie wizytowki lokali (bez szkicow). Kolejka do akceptu zyje w /kolejka?typ=wizytowki -
// TU sa dane: przegladanie, poprawka nazwy, publikacja i usuniecie.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  AppShell, PageHeader, Toolbar, FilterChips, DataTable, StatusBadge, Button, TextField,
  Panel, ConfirmDialog, type Column, type Chip, type Tone,
} from "../../ui";
import { RequireTier } from "../../RequireTier";
import { useAllBusinesses, useEditBusiness, useDeleteBusiness, type BizRow } from "./useAllBusinesses";

const STATUS_TONE: Record<string, Tone> = { approved: "ok", pending: "warn", rejected: "bad" };
const STATUS_LABEL: Record<string, string> = { approved: "Zaakceptowana", pending: "Czeka", rejected: "Odrzucona" };

type Filter = "all" | "live" | "offline" | "orphan";

export function BusinessesPage() {
  const { data, isLoading, isError } = useAllBusinesses();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<BizRow | null>(null);
  const [deleting, setDeleting] = useState<BizRow | null>(null);
  const [reason, setReason] = useState("");
  const edit = useEditBusiness();
  const del = useDeleteBusiness();

  const all = data ?? [];
  const chips: Chip[] = [
    { id: "all", label: "Wszystkie", count: all.length },
    { id: "live", label: "W aplikacji", count: all.filter((b) => b.is_active).length },
    { id: "offline", label: "Schowane", count: all.filter((b) => !b.is_active).length },
    { id: "orphan", label: "Bez właściciela", count: all.filter((b) => !b.owner_user_id).length },
  ];

  const shown = useMemo(() => {
    let list = all;
    if (filter === "live") list = list.filter((b) => b.is_active);
    if (filter === "offline") list = list.filter((b) => !b.is_active);
    if (filter === "orphan") list = list.filter((b) => !b.owner_user_id);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((b) => (b.business_name || "").toLowerCase().includes(q) || (b.city || "").toLowerCase().includes(q));
    return list;
  }, [all, filter, search]);

  const togglePublish = (biz: BizRow) => edit.mutate({ id: biz.id, patch: { is_active: !biz.is_active } }, {
    onSuccess: () => toast.success(biz.is_active ? "Wizytówka schowana z aplikacji" : "Wizytówka widoczna w aplikacji"),
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać"),
  });

  const confirmDelete = () => {
    if (!deleting) return;
    del.mutate({ profileId: deleting.id, reason: reason.trim() }, {
      onSuccess: () => { toast.success("Wizytówka usunięta"); setDeleting(null); setReason(""); },
      onError: (e: any) => toast.error(e.message || "Nie udało się usunąć"),
    });
  };

  const columns: Column<BizRow>[] = [
    {
      key: "name", label: "Lokal", primary: true,
      render: (b) => <span className="truncate font-medium text-[var(--ink)]">{b.business_name || "Wizytówka bez nazwy"}</span>,
    },
    {
      key: "where", label: "Miasto", secondary: true, width: 200,
      render: (b) => <span>{[b.city, b.main_category].filter(Boolean).join(" · ") || "-"}</span>,
    },
    {
      key: "status", label: "Moderacja", width: 150,
      render: (b) => <StatusBadge tone={STATUS_TONE[b.moderation_status] ?? "neutral"}>{STATUS_LABEL[b.moderation_status] ?? b.moderation_status}</StatusBadge>,
    },
    {
      key: "live", label: "W aplikacji", width: 130,
      render: (b) => b.is_active
        ? <StatusBadge tone="ok" mono>WIDOCZNA</StatusBadge>
        : <StatusBadge tone="neutral" mono>SCHOWANA</StatusBadge>,
    },
    {
      key: "created", label: "Dodana", width: 110, align: "right",
      render: (b) => <span className="data text-[var(--stone)]">{format(new Date(b.created_at), "dd.MM.yyyy")}</span>,
    },
    {
      key: "akcje", label: "", width: 190, align: "right", hideOnMobile: true,
      render: (b) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(b)}>Edytuj</Button>
          <Button
            icon={b.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            disabled={edit.isPending}
            title={b.is_active ? "Schowaj z aplikacji" : "Pokaż w aplikacji"}
            onClick={() => togglePublish(b)}
          />
          <RequireTier tier="super_admin">
            <Button
              icon={<Trash2 className="h-3.5 w-3.5" />}
              title="Usuń wizytówkę"
              onClick={() => { setDeleting(b); setReason(""); }}
            />
          </RequireTier>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader title="Wizytówki" subtitle="Wszystkie wizytówki lokali poza szkicami. Kolejka do akceptu jest w Kolejce." />

      <Toolbar search={search} onSearch={setSearch} placeholder="Szukaj po nazwie albo mieście" count={`${shown.length} wizytówek`}>
        <FilterChips chips={chips} value={filter} onChange={(id) => setFilter(id as Filter)} />
      </Toolbar>

      {isError ? (
        <p className="py-12 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać wizytówek.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={shown}
          keyOf={(b) => b.id}
          loading={isLoading}
          empty={{ fact: "Żadna wizytówka nie pasuje do filtrów.", next: "Wyczyść szukanie albo wybierz „Wszystkie”." }}
        />
      )}

      {editing ? (
        <EditPanel biz={editing} onClose={() => setEditing(null)} />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        busy={del.isPending}
        confirmDisabled={!reason.trim()}
        consequence={`Usuniesz wizytówkę „${deleting?.business_name ?? ""}”. Lokal zniknie z aplikacji, a operacja trafi do dziennika audytu.`}
        confirmLabel="Usuń wizytówkę"
        onCancel={() => { setDeleting(null); setReason(""); }}
        onConfirm={confirmDelete}
      >
        <TextField value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Powód usunięcia (trafia do audytu)" />
      </ConfirmDialog>
    </AppShell>
  );
}

function EditPanel({ biz, onClose }: { biz: BizRow; onClose: () => void }) {
  const edit = useEditBusiness();
  const [form, setForm] = useState({
    business_name: biz.business_name ?? "",
    main_category: biz.main_category ?? "",
    city: biz.city ?? "",
  });

  const save = () => edit.mutate({ id: biz.id, patch: form }, {
    onSuccess: () => { toast.success("Zapisano"); onClose(); },
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać"),
  });

  return (
    <Panel title="Edycja wizytówki" subtitle={biz.business_name ?? undefined} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="Nazwa" value={form.business_name} onChange={(v) => setForm((f) => ({ ...f, business_name: v }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategoria" value={form.main_category} onChange={(v) => setForm((f) => ({ ...f, main_category: v }))} />
          <Field label="Miasto" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1" disabled={edit.isPending} onClick={save}>
            {edit.isPending ? "…" : "Zapisz zmiany"}
          </Button>
          <Button onClick={onClose}>Anuluj</Button>
        </div>
      </div>
    </Panel>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--stone)]">{label}</span>
      <TextField value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
