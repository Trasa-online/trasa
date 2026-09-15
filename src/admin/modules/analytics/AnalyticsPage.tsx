// Analityka. Liczby operacyjne lecą prosto z bazy, produktowe z PostHoga.
import { useState } from "react";
import {
  AppShell, PageHeader, Section, Metric, Bar, Loading, EmptyState, FilterChips,
} from "../../ui";
import { useOpsMetrics, useProductKpis } from "./useAnalytics";

const RANGES = [
  { id: "7", label: "7 dni" },
  { id: "30", label: "30 dni" },
  { id: "90", label: "90 dni" },
];

export function AnalyticsPage() {
  const [range, setRange] = useState("30");
  const ops = useOpsMetrics();
  const kpis = useProductKpis(Number(range));
  const k = kpis.data?.kpis;

  return (
    <AppShell>
      <PageHeader title="Analityka" subtitle="Moderacja, lejek B2B i konta na żywo z bazy. Produkt z PostHoga." />

      <Section title="Moderacja">
        {ops.isLoading ? <Loading /> : ops.isError ? (
          <EmptyState fact="Liczby moderacji nie przyszły." next="Sprawdź, czy migracja moderacji weszła na produkcję." />
        ) : ops.data ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric
              label="Czeka na decyzję"
              value={ops.data.moderation.pending}
              tone={ops.data.moderation.pending > 0 ? "warn" : "neutral"}
            />
            <Metric label="Zaakceptowane" value={ops.data.moderation.approved} />
            <Metric label="Odrzucone" value={ops.data.moderation.rejected} />
            <Metric label="Mediana decyzji" value={fmtDur(ops.data.moderation.medianMs)} />
          </div>
        ) : null}
      </Section>

      <Section title="Lejek B2B">
        {ops.isLoading ? <Loading /> : ops.data ? (
          <div className="flex flex-col gap-3 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5">
            <Funnel steps={[
              { label: "Wizytówki założone", value: ops.data.funnel.profiles },
              { label: "Zaakceptowane", value: ops.data.funnel.approved },
              { label: "Aktywne w aplikacji", value: ops.data.funnel.active },
            ]} />
          </div>
        ) : null}
      </Section>

      <Section title="Konta">
        {ops.isLoading ? <Loading /> : ops.data ? (
          <div className="grid grid-cols-3 gap-2.5">
            <Metric label="Łącznie" value={ops.data.accounts.total} />
            <Metric label="Firmy" value={ops.data.accounts.business} />
            <Metric label="Użytkownicy" value={ops.data.accounts.consumer} />
          </div>
        ) : null}
      </Section>

      <Section
        title="Produkt"
        right={<FilterChips chips={RANGES} value={range} onChange={setRange} />}
      >
        {kpis.isLoading ? <Loading /> : kpis.isError ? (
          <EmptyState fact="PostHog nie odpowiedział." next="Liczby wrócą same przy następnym odświeżeniu - nic tu nie trzeba klikać." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label={`Rejestracje (${range} dni)`} value={k?.signups?.value ?? 0} hint={delta(k?.signups?.deltaPct)} />
            <Metric label="DAU" value={k?.dau ?? 0} />
            <Metric label="WAU" value={k?.wau ?? 0} />
            <Metric label="MAU" value={k?.mau ?? 0} />
            <Metric label={`Wyjazdy (${range} dni)`} value={k?.routes?.value ?? 0} hint={delta(k?.routes?.deltaPct)} />
          </div>
        )}
      </Section>
    </AppShell>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <>
      {steps.map((s, i) => {
        const conv = i > 0 && steps[i - 1].value > 0 ? Math.round((s.value / steps[i - 1].value) * 100) : null;
        return (
          <div key={s.label}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="text-[var(--graphite)]">{s.label}</span>
              <span className="data text-[var(--ink)]">
                {s.value}
                {conv != null ? <span className="text-[var(--stone)]"> · {conv}%</span> : null}
              </span>
            </div>
            <Bar pct={Math.round((s.value / max) * 100)} />
          </div>
        );
      })}
    </>
  );
}

const delta = (pct?: number | null) =>
  pct == null ? undefined : `${pct >= 0 ? "+" : ""}${pct}% wobec poprzedniego okresu`;

function fmtDur(ms: number | null): string {
  if (ms == null) return "-";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} dni`;
}
