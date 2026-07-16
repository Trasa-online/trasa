import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, RotateCcw, MapPin, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { useBugReports, useResolveBug, useCityDemand, type BugReport } from "./useOps";

export function OpsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Zgłoszenia i miasta</h1>
        <p className="text-sm text-slate-500 mt-1">Zgłoszenia od użytkowników i biznesów oraz zapotrzebowanie na nowe miasta.</p>
      </div>
      <BugsSection />
      <CitiesSection />
    </div>
  );
}

function BugsSection() {
  const { data, isLoading, isError } = useBugReports();
  const [source, setSource] = useState<"user" | "business">("user");
  const [tab, setTab] = useState<"open" | "resolved">("open");

  // Zgloszenia biznesowe maja source='business' (fallback: prefix "[Panel biznesowy" dla
  // rekordow sprzed migracji, gdyby backfill nie objal wszystkiego).
  const isBusiness = (b: BugReport) => b.source === "business" || (b.source == null && b.description?.startsWith("[Panel biznesowy"));

  const bySource = useMemo(() => {
    const all = data ?? [];
    const business = all.filter(isBusiness);
    const user = all.filter((b) => !isBusiness(b));
    return { user, business };
  }, [data]);

  const list = bySource[source];
  const open = list.filter((b) => b.status !== "resolved");
  const resolved = list.filter((b) => b.status === "resolved");
  const shown = tab === "open" ? open : resolved;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Zgłoszenia</h2>
        <div className="flex gap-1 bg-slate-100 rounded-full p-0.5">
          <TabBtn active={source === "user"} onClick={() => setSource("user")} label="Użytkownicy" n={bySource.user.length} />
          <TabBtn active={source === "business"} onClick={() => setSource("business")} label="Biznesy" n={bySource.business.length} />
        </div>
      </div>
      <div className="flex justify-end mb-3">
        <div className="flex gap-1 bg-slate-100 rounded-full p-0.5">
          <TabBtn active={tab === "open"} onClick={() => setTab("open")} label="Otwarte" n={open.length} />
          <TabBtn active={tab === "resolved"} onClick={() => setTab("resolved")} label="Rozwiązane" n={resolved.length} />
        </div>
      </div>
      {isLoading ? <Spin /> : isError ? <p className="text-sm text-red-500 py-8 text-center">Nie udało się wczytać.</p>
        : shown.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">{tab === "open" ? `Brak otwartych zgłoszeń od ${source === "user" ? "użytkowników" : "biznesów"} 🎉` : "Brak rozwiązanych."}</p>
        : <div className="space-y-2">{shown.map((b) => <BugRow key={b.id} bug={b} />)}</div>}
    </section>
  );
}

function BugRow({ bug }: { bug: BugReport }) {
  const resolve = useResolveBug();
  const isResolved = bug.status === "resolved";
  const who = bug.reporter?.first_name || bug.reporter?.username || (bug.user_id ? "użytkownik" : "anonim");

  const toggle = () => {
    resolve.mutate({ id: bug.id, status: isResolved ? "open" : "resolved" }, {
      onSuccess: () => toast.success(isResolved ? "Przywrócono" : "Oznaczono jako rozwiązane"),
      onError: (e: any) => toast.error(e.message || "Błąd"),
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex gap-3">
        {bug.screenshot_url ? (
          <a href={bug.screenshot_url} target="_blank" rel="noreferrer" className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">
            <img src={bug.screenshot_url} alt="" className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="h-14 w-14 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center"><ImageIcon className="h-5 w-5 text-slate-300" /></div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 leading-snug whitespace-pre-wrap">{bug.description}</p>
          <p className="text-xs text-slate-400 mt-1.5">{who} · {format(new Date(bug.created_at), "dd.MM.yyyy HH:mm")}</p>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <button onClick={toggle} disabled={resolve.isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-60 ${isResolved ? "bg-slate-100 hover:bg-slate-200 text-slate-600" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
          {isResolved ? <><RotateCcw className="h-3.5 w-3.5" />Otwórz ponownie</> : <><Check className="h-4 w-4" />Rozwiązane</>}
        </button>
      </div>
    </div>
  );
}

function CitiesSection() {
  const { data, isLoading } = useCityDemand();
  const max = Math.max(1, data?.[0]?.count ?? 1);
  return (
    <section>
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Zapotrzebowanie na miasta</h2>
      {isLoading ? <Spin /> : !data || data.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">Brak próśb o miasta.</p> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2.5">
          {data.map((c) => (
            <div key={c.city}>
              <div className="flex justify-between text-sm mb-1">
                <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium"><MapPin className="h-3.5 w-3.5 text-slate-400" />{c.city}</span>
                <span className="text-slate-500 font-semibold">{c.count}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#F4A259] to-[#F9662B]" style={{ width: `${Math.max(6, Math.round((c.count / max) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TabBtn({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
      {label} <span className="text-[10px]">{n}</span>
    </button>
  );
}

const Spin = () => <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
