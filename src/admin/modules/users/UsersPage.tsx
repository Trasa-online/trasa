import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useUsers, useSoftDelete, type AdminUser } from "./useUsers";
import { useAdmin } from "../../RequireAdmin";

type Filter = "all" | "business" | "consumer";

export function UsersPage() {
  const { data, isLoading, isError } = useUsers();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const all = data ?? [];
    const business = all.filter((u) => u.isBusiness).length;
    return { all: all.length, business, consumer: all.length - business };
  }, [data]);

  const shown = useMemo(() => {
    let list = data ?? [];
    if (filter === "business") list = list.filter((u) => u.isBusiness);
    if (filter === "consumer") list = list.filter((u) => !u.isBusiness);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((u) => (u.username || "").toLowerCase().includes(q) || (u.first_name || "").toLowerCase().includes(q));
    return list;
  }, [data, filter, search]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Użytkownicy</h1>
        <p className="text-sm text-slate-500 mt-1">Wszystkie konta. Usuwanie (soft-delete) tylko super-admin.</p>
      </div>

      {/* Filtr */}
      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1 mb-3">
        {([
          { id: "all", label: "Wszyscy", n: counts.all },
          { id: "business", label: "Firmy", n: counts.business },
          { id: "consumer", label: "Użytkownicy", n: counts.consumer },
        ] as const).map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${filter === f.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            {f.label}<span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === f.id ? "bg-slate-100" : "bg-white/70"}`}>{f.n}</span>
          </button>
        ))}
      </div>

      {/* Szukaj */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 mb-4">
        <Search className="h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj po nazwie…" className="flex-1 bg-transparent text-sm outline-none text-slate-900" />
      </div>

      {isLoading ? <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        : isError ? <p className="text-sm text-red-500 py-12 text-center">Nie udało się wczytać listy.</p>
        : shown.length === 0 ? <p className="text-sm text-slate-400 py-12 text-center">Brak kont dla tego filtra.</p>
        : <div className="space-y-2">{shown.map((u) => <UserRow key={u.id} user={u} />)}</div>}
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const { isSuperAdmin } = useAdmin();
  const del = useSoftDelete();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const doDelete = () => {
    if (!reason.trim()) { toast.error("Podaj powód"); return; }
    del.mutate({ userId: user.id, reason: reason.trim() }, {
      onSuccess: () => toast.success("Konto usunięte (soft-delete)"),
      onError: (e: any) => toast.error(e.message || "Błąd"),
    });
  };

  return (
    <div className={`border rounded-2xl p-3 bg-white ${user.deleted ? "border-slate-100 opacity-60" : "border-slate-100"}`}>
      <div className="flex items-center gap-3">
        {user.avatar_url
          ? <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
          : <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${user.isBusiness ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500"}`}>
              {(user.first_name || user.username || "?").charAt(0).toUpperCase()}
            </div>}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 truncate">
            {user.first_name || "—"}
            <span className="text-slate-400 font-normal ml-1">@{user.username}</span>
            {user.isBusiness && <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold align-middle">Firma</span>}
            {user.is_anonymous && <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold align-middle">Anonim</span>}
            {user.deleted && <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold align-middle">Usunięty</span>}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{user.created_at ? format(new Date(user.created_at), "dd.MM.yyyy") : "—"}</p>
        </div>
        {isSuperAdmin && !user.deleted && (
          <button onClick={() => setConfirming((v) => !v)} title="Usuń konto"
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {confirming && !user.deleted && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Powód usunięcia (do audytu)…"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400" />
          <div className="flex gap-2">
            <button onClick={doDelete} disabled={del.isPending}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60">
              {del.isPending ? "…" : "Usuń"}
            </button>
            <button onClick={() => { setConfirming(false); setReason(""); }} disabled={del.isPending}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}
