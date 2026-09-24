// Koszty Google. Na gorze PRAWDZIWY rachunek z eksportu rozliczen (PLN, jak na fakturze),
// nizej dwa bezpieczniki proxy: miesieczny na wyszukiwarke i dzienny na wszystko.
// ⛔ Bez przeliczania wywolan na dolary (2026-09-20): licznik x cennik katalogowy dawal "$52",
// gdy faktura mowila 23,85 zl - Google ma darmowa pule per SKU, a licznik nie widzi
// geokodowania, Maps JS ani zdjec. Kwota jest w rachunku, liczniki to tylko stan limitow.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ExternalLink } from "lucide-react";
import { format, parseISO, getDaysInMonth } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { AppShell, PageHeader, Section, Metric, Bar, Loading, EmptyState, DataTable, Button, type Column } from "../../ui";
import {
  useTextsearchMonthly,
  useDailyGoogleQuota,
  useGoogleBilling,
  useManualBilling,
  saveManualBilling,
  syncGoogleBilling,
  TEXTSEARCH_MONTHLY_LIMIT,
  DAILY_CALL_LIMIT,
  type MonthUsage,
  type DayUsage,
  type BillingRow,
} from "./useApiCosts";

const pl = (n: number) => n.toLocaleString("pl-PL");
// Waluta konta rozliczeniowego Google (PLN) - to, co jest na fakturze.
const money = (n: number, cur = "PLN") => n.toLocaleString("pl-PL", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GOOGLE_BILLING_URL = "https://console.cloud.google.com/billing";

export function CostsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Koszty API"
        subtitle="Rachunek Google Cloud z eksportu rozliczeń (kwoty jak na fakturze) oraz stan limitów, po których proxy przestaje wołać Google."
      />
      <Billing />
      <Monthly />
      <Daily />
    </AppShell>
  );
}

/* ── RACHUNEK GOOGLE ────────────────────────────────────────────────────────
   google_billing_daily <- google-billing-sync <- eksport rozliczen w BigQuery. "Do zaplaty" =
   koszt katalogowy - rabaty/darmowa pula. Prognoza = tempo z dni, ktore Google juz rozliczyl
   (eksport dosypuje dane z ~dobowym opoznieniem, wiec dzisiejszy dzien zwykle jeszcze nie jest). */
function Billing() {
  const { data, isLoading, isError } = useGoogleBilling();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const now = new Date();
  const monthKey = format(now, "yyyy-MM");
  const prevKey = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), "yyyy-MM");
  const rows = data ?? [];
  const cur = rows[0]?.currency ?? "PLN";
  const net = (rs: BillingRow[]) => rs.reduce((a, r) => a + r.cost - r.credits, 0);
  const thisMonth = rows.filter((r) => r.day.startsWith(monthKey));
  const lastMonth = rows.filter((r) => r.day.startsWith(prevKey));
  const due = net(thisMonth);
  const list = thisMonth.reduce((a, r) => a + r.cost, 0);
  const saved = thisMonth.reduce((a, r) => a + r.credits, 0);
  // ⛔ OKRES LICZYMY Z DANYCH, NIE OD PIERWSZEGO DNIA MIESIACA. Eksport rozliczen ruszyl
  // 20.09 i Google NIE uzupelnia go wstecz, wiec mamy dane z kilku dni, a panel pisal
  // „za dni 1-23" i dzielil tempo przez 23 - klamal o zakresie i zanizal prognoze.
  // ⚠️ Ta poprawka byla zrobiona na `main` 2026-09-23, ale panel buduje sie z galezi `admin`
  // i nigdy tu nie dojechala - stad drugie zgloszenie Nat („caly czas zle kwoty").
  const dayNums = thisMonth.map((r) => Number(r.day.slice(8, 10)));
  const lastDay = dayNums.length ? Math.max(...dayNums) : 0;
  const firstDay = dayNums.length ? Math.min(...dayNums) : 0;
  const coveredDays = new Set(thisMonth.map((r) => r.day)).size;
  const partialMonth = firstDay > 1;
  // Reczne uzupelnienie dni SPRZED eksportu (migracja 20260924f). Bez tego wielka liczba
  // w panelu nie zgadza sie z konsola Google - a to ona jest punktem odniesienia.
  const { data: manual } = useManualBilling(monthKey);
  const manualAmount = manual?.amount ?? 0;
  const total = due + manualAmount;
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  // ⚠️ Prognoza idzie z TEMPA dni, ktore realnie mamy - reczna kwota sprzed eksportu to koszt
  // juz PONIESIONY, wiec dokladamy ja na koncu, a nie mnozymy przez dni miesiaca.
  const forecast = coveredDays > 0 ? (due / coveredDays) * getDaysInMonth(now) + manualAmount : 0;
  const syncedAt = rows.length ? rows.reduce((a, r) => (r.synced_at > a ? r.synced_at : a), rows[0].synced_at) : null;

  // Rozbicie na uslugi (Places API, Maps JavaScript API, Geocoding...), netto, malejaco.
  type ServiceRow = { service: string; amount: number };
  const byService: ServiceRow[] = Array.from(thisMonth.reduce((m, r) => {
    const k = r.service || "(inne)";
    m.set(k, (m.get(k) ?? 0) + r.cost - r.credits);
    return m;
  }, new Map<string, number>())).map(([service, amount]) => ({ service, amount })).sort((a, b) => b.amount - a.amount);
  const maxService = Math.max(0.01, ...byService.map((s) => s.amount));
  const columns: Column<ServiceRow>[] = [
    { key: "service", label: "Usługa", primary: true, render: (s) => <span>{s.service}</span> },
    {
      key: "amount", label: "Do zapłaty", align: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <Bar pct={Math.round((Math.max(0, s.amount) / maxService) * 100)} className="hidden w-24 md:block" />
          <span className="data">{money(s.amount, cur)}</span>
        </div>
      ),
    },
  ];

  const sync = async () => {
    setSyncing(true); setSyncMsg(null);
    const res = await syncGoogleBilling();
    setSyncing(false);
    setSyncMsg(res.ok ? (res.note ? "Google nie założył jeszcze tabeli eksportu" : `Pobrano ${res.rows ?? 0} wierszy`) : `Błąd: ${res.error ?? "nieznany"}`);
    qc.invalidateQueries({ queryKey: ["api-costs", "google-billing"] });
  };

  const right = (
    <div className="flex items-center gap-2">
      <a href={GOOGLE_BILLING_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[var(--stone)] hover:text-[var(--ink)]">
        Google Billing <ExternalLink className="h-3 w-3" />
      </a>
      <Button onClick={sync} disabled={syncing} icon={<RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />}>Odśwież</Button>
    </div>
  );

  return (
    <Section title={`Rachunek Google · ${format(now, "LLLL yyyy", { locale: dateLocale() })}`} right={right}>
      {isLoading ? <Loading /> : isError ? (
        <EmptyState fact="Rachunek nie przyszedł." next="Odśwież stronę - dane żyją w tabeli google_billing_daily." />
      ) : rows.length === 0 ? (
        <EmptyState
          fact="Eksport rozliczeń jeszcze nie dojechał."
          next="Google zapisuje pierwsze wiersze kilka godzin po włączeniu eksportu i nie uzupełnia ich wstecz. Synchronizacja idzie sama raz dziennie o 6:20; „Odśwież” dociąga od razu."
        />
      ) : (
        <>
          {partialMonth && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-900">
                Ten miesiąc jest niepełny - eksport rozliczeń rusza od dnia {firstDay}.
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
                Google nie uzupełnia eksportu wstecz, więc dni {firstDay > 2 ? `1-${firstDay - 1}` : "wcześniejsze"} nie są w nim liczone.
                {manualAmount > 0
                  ? " Brakujący kawałek jest wpisany ręcznie, więc kwota wyżej zgadza się z konsolą Google."
                  : " Dopóki go nie uzupełnisz, w Google Cloud zobaczysz kwotę WYŻSZĄ - to nie jest błąd panelu."}
              </p>
              {/* Jedyne uczciwe wyjscie na TEN miesiac: przepisac brakujacy kawalek z konsoli.
                  Cloud Billing API nie oddaje kosztow, a eksport nie cofa sie. */}
              {!manualOpen ? (
                <button
                  onClick={() => { setManualOpen(true); setManualDraft(manualAmount ? String(manualAmount) : ""); }}
                  className="mt-2 text-[11px] font-bold text-amber-900 underline underline-offset-2"
                >
                  {manualAmount > 0 ? "Zmień kwotę sprzed eksportu" : `Wpisz kwotę z Google za dni 1-${Math.max(1, firstDay - 1)}`}
                </button>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" step="0.01" min="0" inputMode="decimal" autoFocus
                    value={manualDraft}
                    onChange={(e) => setManualDraft(e.target.value)}
                    placeholder="np. 23.03"
                    className="h-8 w-28 rounded-lg border border-amber-300 bg-white px-2 text-xs tabular-nums outline-none focus:border-amber-500"
                  />
                  <button
                    disabled={manualSaving}
                    onClick={async () => {
                      setManualSaving(true);
                      const v = manualDraft.trim() === "" ? null : Number(manualDraft.replace(",", "."));
                      const res = await saveManualBilling(monthKey, v, `dni 1-${Math.max(1, firstDay - 1)} z konsoli Google`);
                      setManualSaving(false);
                      if (!res.ok) { setSyncMsg(`Błąd zapisu: ${res.error}`); return; }
                      setManualOpen(false);
                      qc.invalidateQueries({ queryKey: ["api-costs", "billing-manual", monthKey] });
                    }}
                    className="h-8 rounded-lg bg-amber-900 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    Zapisz
                  </button>
                  <button onClick={() => setManualOpen(false)} className="text-[11px] font-semibold text-amber-900/70">Anuluj</button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric
              label={manualAmount > 0 ? "Do zapłaty w tym miesiącu" : `Do zapłaty, dni ${firstDay}-${lastDay}`}
              value={money(total, cur)}
              hint={manualAmount > 0 ? `${money(due, cur)} z eksportu + ${money(manualAmount, cur)} wpisane ręcznie` : `${coveredDays} ${coveredDays === 1 ? "dzień" : "dni"} w eksporcie`}
              tone="ok"
            />
            <Metric label="Prognoza na miesiąc" value={`≈ ${money(forecast, cur)}`} hint="z tempa rozliczonych dni" />
            <Metric label="Rabaty i darmowa pula" value={`-${money(saved, cur)}`} hint={`z ${money(list, cur)} wg cennika`} />
            <Metric label="Poprzedni miesiąc" value={lastMonth.length ? money(net(lastMonth), cur) : "-"} />
          </div>
          {byService.length ? <DataTable columns={columns} rows={byService} keyOf={(s) => s.service} /> : null}
        </>
      )}
      <p className="text-[12px] leading-5 text-[var(--stone)]">
        {syncedAt ? `Zsynchronizowano ${format(parseISO(syncedAt), "d MMMM, HH:mm", { locale: dateLocale() })}` : "Jeszcze nie synchronizowano"}
        {syncMsg ? ` · ${syncMsg}` : ""}
      </p>
    </Section>
  );
}

function Monthly() {
  const { data, isLoading, isError } = useTextsearchMonthly();

  const now = new Date();
  const monthStart = format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), "yyyy-MM-dd");
  const current: MonthUsage = data?.find((m) => m.month === monthStart) ?? { month: monthStart, textsearch_calls: 0 };
  const calls = current.textsearch_calls;
  const pct = Math.min(100, Math.round((calls / TEXTSEARCH_MONTHLY_LIMIT) * 100));
  const blocked = calls >= TEXTSEARCH_MONTHLY_LIMIT;
  const near = !blocked && pct >= 80;
  const tone = blocked ? "bad" : near ? "warn" : "ok";
  const history = (data ?? []).filter((m) => m.month !== monthStart);

  const columns: Column<MonthUsage>[] = [
    {
      key: "month", label: "Miesiąc", primary: true,
      render: (m) => <span className="capitalize">{format(parseISO(m.month), "LLLL yyyy", { locale: dateLocale() })}</span>,
    },
    { key: "calls", label: "Wywołania", width: 160, align: "right", render: (m) => <span className="data">{pl(m.textsearch_calls)}</span> },
  ];

  return (
    <>
      <Section title="Limit wyszukiwarki (Text Search) · bieżący miesiąc">
        {isLoading ? <Loading /> : isError ? (
          <EmptyState fact="Dane o zużyciu nie przyszły." next="Odśwież stronę - licznik żyje w bazie, nie w przeglądarce." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Metric label="Wywołania" value={pl(calls)} hint={`z ${pl(TEXTSEARCH_MONTHLY_LIMIT)}`} tone={tone} />
              <Metric label="Zostało" value={pl(Math.max(0, TEXTSEARCH_MONTHLY_LIMIT - calls))} />
              <Metric label="Wykorzystanie" value={`${pct}%`} tone={tone} />
            </div>
            <Bar pct={pct} tone={tone} className="mt-1" />
            <p className="text-[12px] leading-5 text-[var(--stone)]">
              Bezpiecznik kosztowy, nie koszt: po przekroczeniu proxy przestaje wołać Google do końca miesiąca.
              Podnosisz go sekretem <span className="data">GOOGLE_TEXTSEARCH_MONTHLY_LIMIT</span> funkcji google-places-proxy (i stałą w useApiCosts.ts).
            </p>
            {blocked ? (
              <p className="text-[12px] leading-5 text-[var(--bad)]">
                Wyszukiwarka jest zablokowana do końca miesiąca. Użytkownicy widzą propozycje z bazy zamiast wyników
                Google. Limit zeruje się pierwszego dnia następnego miesiąca (UTC).
              </p>
            ) : null}
          </>
        )}
      </Section>

      {history.length ? (
        <Section title="Poprzednie miesiące">
          <DataTable columns={columns} rows={history} keyOf={(m) => m.month} />
        </Section>
      ) : null}
    </>
  );
}

function Daily() {
  const { data, isLoading, isError } = useDailyGoogleQuota();
  const today = format(new Date(), "yyyy-MM-dd");
  const calls = data?.find((d) => d.day === today)?.google_calls ?? 0;
  const pct = Math.min(100, Math.round((calls / DAILY_CALL_LIMIT) * 100));
  const tone = pct >= 100 ? "bad" : pct >= 80 ? "warn" : "ok";
  const max = Math.max(1, ...(data ?? []).map((d) => d.google_calls));

  const columns: Column<DayUsage>[] = [
    {
      key: "day", label: "Dzień", primary: true,
      render: (d) => <span>{format(parseISO(d.day), "d MMMM", { locale: dateLocale() })}</span>,
    },
    {
      key: "calls", label: "Wywołania", align: "right",
      render: (d) => (
        <div className="flex items-center justify-end gap-2">
          <Bar pct={Math.round((d.google_calls / max) * 100)} className="hidden w-24 md:block" />
          <span className="data">{pl(d.google_calls)}</span>
        </div>
      ),
    },
  ];

  return (
    <Section title="Wszystkie wywołania Google · dziś">
      {isLoading ? <Loading /> : isError ? (
        <EmptyState fact="Dzienny licznik nie przyszedł." next="Odśwież stronę - to ta sama tabela, co miesięczna." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Metric label="Dziś" value={pl(calls)} hint={`z ${pl(DAILY_CALL_LIMIT)} dziennego bezpiecznika`} tone={tone} />
            <Metric label="Wykorzystanie" value={`${pct}%`} tone={tone} />
            <Metric label="Zostało" value={pl(Math.max(0, DAILY_CALL_LIMIT - calls))} />
          </div>
          <Bar pct={pct} tone={tone} className="mt-1" />
          <p className="text-[12px] leading-5 text-[var(--stone)]">
            Bezpiecznik obejmuje wszystkie płatne wywołania razem: wyszukiwarkę, szczegóły miejsc i zdjęcia.
          </p>
          {data && data.length > 1 ? (
            <DataTable columns={columns} rows={data} keyOf={(d) => d.day} />
          ) : null}
        </>
      )}
    </Section>
  );
}
