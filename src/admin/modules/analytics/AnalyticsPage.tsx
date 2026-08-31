import { useState } from "react";
import { Loader2, Clock, Store, CheckCircle2, XCircle, Users, Building2, UserRound, Route as RouteIcon } from "lucide-react";
import { useOpsMetrics, useProductKpis } from "./useAnalytics";

const RANGES = [7, 30, 90];

export function AnalyticsPage() {
  const [range, setRange] = useState(30);
  const ops = useOpsMetrics();
  const kpis = useProductKpis(range);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Analityka</h1>
        <p className="text-sm text-slate-500 mt-1">Operacje, lejek B2B i konta na żywo z bazy. Produkt z PostHog.</p>
      </div>

      {/* ── Operacje / moderacja ── */}
      <Section title="Operacje · moderacja">
        {ops.isLoading ? <Spin /> : ops.isError ? <Err msg="Nie udało się wczytać (czy migracja moderacji wykonana?)" /> : ops.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={Store} label="Backlog (czeka)" value={ops.data.moderation.pending} alert={ops.data.moderation.pending > 0} />
            <Stat icon={CheckCircle2} label="Zaakceptowane" value={ops.data.moderation.approved} />
            <Stat icon={XCircle} label="Odrzucone" value={ops.data.moderation.rejected} />
            <Stat icon={Clock} label="Mediana decyzji" value={fmtDur(ops.data.moderation.medianMs)} />
          </div>
        )}
      </Section>

      {/* ── Lejek B2B ── */}
      <Section title="Lejek B2B">
        {ops.isLoading ? <Spin /> : ops.data && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <Funnel steps={[
              { label: "Wizytówki założone", value: ops.data.funnel.profiles },
              { label: "Zaakceptowane", value: ops.data.funnel.approved },
              { label: "Aktywne (na żywo)", value: ops.data.funnel.active },
            ]} />
          </div>
        )}
      </Section>

      {/* ── Konta ── */}
      <Section title="Konta">
        {ops.isLoading ? <Spin /> : ops.data && (
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Users} label="Łącznie" value={ops.data.accounts.total} />
            <Stat icon={Building2} label="Firmy" value={ops.data.accounts.business} />
            <Stat icon={UserRound} label="Użytkownicy" value={ops.data.accounts.consumer} />
          </div>
        )}
      </Section>

      {/* ── Produkt (PostHog) ── */}
      <Section
        title="Produkt"
        right={
          <div className="flex gap-1 bg-slate-100 rounded-full p-0.5">
            {RANGES.map((d) => (
              <button key={d} onClick={() => setRange(d)}
                className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-colors ${range === d ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
                {d} dni
              </button>
            ))}
          </div>
        }
      >
        {kpis.isLoading ? <Spin /> : kpis.isError ? (
          <Err msg="Dane produktowe (PostHog) chwilowo niedostępne." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={Users} label={`Rejestracje (${range}d)`} value={kpis.data?.kpis?.signups?.value ?? 0} delta={kpis.data?.kpis?.signups?.deltaPct} />
            <Stat icon={Users} label="DAU" value={kpis.data?.kpis?.dau ?? 0} />
            <Stat icon={Users} label="WAU" value={kpis.data?.kpis?.wau ?? 0} />
            <Stat icon={Users} label="MAU" value={kpis.data?.kpis?.mau ?? 0} />
            <Stat icon={RouteIcon} label={`Trasy (${range}d)`} value={kpis.data?.kpis?.routes?.value ?? 0} delta={kpis.data?.kpis?.routes?.deltaPct} />
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon: Icon, label, value, delta, alert }: { icon: any; label: string; value: number | string; delta?: number | null; alert?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${alert ? "border-red-200" : "border-slate-100"}`}>
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-black ${alert ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      {delta != null && (
        <div className={`mt-0.5 text-[11px] font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {delta >= 0 ? "+" : ""}{delta}% vs poprz.
        </div>
      )}
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const w = Math.max(4, Math.round((s.value / max) * 100));
        const conv = i > 0 && steps[i - 1].value > 0 ? Math.round((s.value / steps[i - 1].value) * 100) : null;
        return (
          <div key={s.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-700 font-medium">{s.label}</span>
              <span className="text-slate-500">{s.value}{conv != null && <span className="text-slate-400"> · {conv}%</span>}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900" style={{ width: `${w}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Spin = () => <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
const Err = ({ msg }: { msg: string }) => <p className="text-sm text-slate-400 py-6 text-center">{msg}</p>;

function fmtDur(ms: number | null): string {
  if (ms == null) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} dni`;
}
