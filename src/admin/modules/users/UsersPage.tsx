// Konta. Tabela na desktopie, karty rekordow ponizej `md` - jedno i drugie z DataTable.
//
// Usuniecie konta jest nieodwracalne, wiec potwierdzenie NAZYWA SKUTEK i wymaga powodu
// (powod idzie do dziennika audytu, nie do kosza).
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  AppShell, PageHeader, Toolbar, FilterChips, DataTable, StatusBadge, ConfirmDialog,
  type Column, type Chip,
} from "../../ui";
import { useUsers, useSoftDelete, type AdminUser } from "./useUsers";
import { RequireTier } from "../../RequireTier";

type Filter = "all" | "business" | "consumer";

export function UsersPage() {
  const { data, isLoading, isError } = useUsers();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const del = useSoftDelete();

  const chips: Chip[] = useMemo(() => {
    const all = data ?? [];
    const business = all.filter((u) => u.isBusiness).length;
    return [
      { id: "all", label: "Wszyscy", count: all.length },
      { id: "business", label: "Firmy", count: business },
      { id: "consumer", label: "Użytkownicy", count: all.length - business },
    ];
  }, [data]);

  const shown = useMemo(() => {
    let list = data ?? [];
    if (filter === "business") list = list.filter((u) => u.isBusiness);
    if (filter === "consumer") list = list.filter((u) => !u.isBusiness);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((u) => (u.username || "").toLowerCase().includes(q) || (u.first_name || "").toLowerCase().includes(q));
    return list;
  }, [data, filter, search]);

  const confirmDelete = () => {
    if (!target) return;
    del.mutate({ userId: target.id, reason: reason.trim() }, {
      onSuccess: () => { toast.success("Konto usunięte (soft-delete)"); setTarget(null); setReason(""); },
      onError: (e: any) => toast.error(e.message || "Nie udało się usunąć konta"),
    });
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "user", label: "Konto", primary: true,
      render: (u) => (
        <div className="flex items-center gap-2.5">
          {u.avatar_url
            ? <img src={u.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            : <span className="data flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--canvas)] text-[12px] text-[var(--graphite)]">
                {(u.first_name || u.username || "?").charAt(0).toUpperCase()}
              </span>}
          <span className="truncate font-medium text-[var(--ink)]">{u.first_name || "bez imienia"}</span>
        </div>
      ),
    },
    { key: "username", label: "Nazwa", secondary: true, render: (u) => <span className="data">@{u.username ?? "-"}</span> },
    {
      key: "typ", label: "Typ", width: 150,
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone="neutral">{u.isBusiness ? "Firma" : "Użytkownik"}</StatusBadge>
          {u.is_anonymous ? <StatusBadge tone="neutral">Anonim</StatusBadge> : null}
        </div>
      ),
    },
    {
      key: "status", label: "Stan", width: 120,
      render: (u) => u.deleted
        ? <StatusBadge tone="bad" mono>USUNIĘTE</StatusBadge>
        : <StatusBadge tone="ok" mono>AKTYWNE</StatusBadge>,
    },
    {
      key: "created", label: "Założone", width: 110, align: "right",
      render: (u) => <span className="data text-[var(--stone)]">{u.created_at ? format(new Date(u.created_at), "dd.MM.yyyy") : "-"}</span>,
    },
    {
      key: "akcje", label: "", width: 56, align: "right", hideOnMobile: true,
      render: (u) => u.deleted ? null : (
        <RequireTier tier="super_admin">
          <button
            type="button" onClick={() => { setTarget(u); setReason(""); }} title="Usuń konto"
            className="rounded-[var(--r-control)] p-1.5 text-[var(--stone)] hover:bg-[var(--bad-bg)] hover:text-[var(--bad)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </RequireTier>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader title="Użytkownicy" subtitle="Wszystkie konta w bazie. Usuwanie konta widzi tylko super-admin." />

      <Toolbar search={search} onSearch={setSearch} placeholder="Szukaj po imieniu albo nazwie" count={`${shown.length} kont`}>
        <FilterChips chips={chips} value={filter} onChange={(id) => setFilter(id as Filter)} />
      </Toolbar>

      {isError ? (
        <p className="py-12 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać listy kont.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={shown}
          keyOf={(u) => u.id}
          loading={isLoading}
          empty={{ fact: "Żadne konto nie pasuje do filtrów.", next: "Wyczyść szukanie albo wybierz inny typ konta." }}
        />
      )}

      <ConfirmDialog
        open={!!target}
        busy={del.isPending}
        confirmDisabled={!reason.trim()}
        consequence={`Usuniesz konto @${target?.username ?? ""}. Profil, kolekcje i wyjazdy znikną z aplikacji, a operacja trafi do dziennika audytu.`}
        confirmLabel="Usuń konto"
        onCancel={() => { setTarget(null); setReason(""); }}
        onConfirm={confirmDelete}
      >
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          placeholder="Powód usunięcia (trafia do audytu)"
          className="h-10 w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)] focus:border-[var(--accent)]"
        />
      </ConfirmDialog>
    </AppShell>
  );
}
