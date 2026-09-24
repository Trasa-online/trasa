import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Globe, Receipt, RefreshCw, ExternalLink } from "lucide-react";
import { format, parseISO, getDaysInMonth } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
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
  type BillingRow,
} from "./useApiCosts";

// Kwoty w walucie konta rozliczeniowego Google (PLN) - to, co jest na fakturze.
const money = (n: number, cur = "PLN") => n.toLocaleString("pl-PL", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GOOGLE_BILLING_URL = "https://console.cloud.google.com/billing";

export function CostsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Koszty API</h1>
        <p className="text-sm text-slate-500 mt-1">
          Rachunek Google Cloud z eksportu rozliczeń (kwoty jak na fakturze, z rabatami i darmową pulą)
          oraz stan limitów, po których proxy przestaje wołać Google.
        </p>
      </div>
      <BillingSection />
      <TextsearchSection />
      <DailySection />
    </div>
  );
}

/* ── RACHUNEK GOOGLE (prawdziwy, w PLN) ──────────────────────────────────────
   Zrodlo: google_billing_daily <- google-billing-sync <- eksport rozliczen w BigQuery.
   "Do zaplaty" = koszt katalogowy - rabaty/darmowa pula. Prognoza = tempo z dni, ktore juz
   sa w eksporcie, przeliczone na caly miesiac (Google dosypuje dane z ~dobowym opoznieniem,
   wiec dzisiejszy dzien zwykle jeszcze nie jest policzony). */
function BillingSection() {
  const { data, isLoading, isError } = useGoogleBilling();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const now = new Date();
  const monthKey = format(now, "yyyy-MM");
  const prevKey = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), "yyyy-MM");
  const rows = data ?? [];
  const cur = rows[0]?.currency ?? "PLN";
  const inMonth = (k: string) => rows.filter((r) => r.day.startsWith(k));
  const net = (rs: BillingRow[]) => rs.reduce((a, r) => a + r.cost - r.credits, 0);
  const gross = (rs: BillingRow[]) => rs.reduce((a, r) => a + r.cost, 0);
  const thisMonth = inMonth(monthKey);
  const lastMonth = inMonth(prevKey);
  const due = net(thisMonth);
  const list = gross(thisMonth);
  const saved = thisMonth.reduce((a, r) => a + r.credits, 0);
  // ⛔ OKRES LICZYMY Z DANYCH, NIE OD PIERWSZEGO DNIA MIESIACA (poprawka 2026-09-23,
  // zgloszenie Nat: "w Google mam 43 zl, a w panelu 13,53 zl"). Eksport rozliczen ruszyl
  // 20.09 i Google NIE uzupelnia go wstecz, wiec mamy dane z 4 dni, a panel pisal "za dni
  // 1-23" i dzielil tempo przez 23 - czyli klamal o zakresie i zanizal prognoze szesciokrotnie.
  const dayNums = thisMonth.map((r) => Number(r.day.slice(8, 10)));
  const lastDay = dayNums.length ? Math.max(...dayNums) : 0;
  const firstDay = dayNums.length ? Math.min(...dayNums) : 0;
  const coveredDays = new Set(thisMonth.map((r) => r.day)).size;
  const partialMonth = firstDay > 1;
  // Reczne uzupelnienie dni SPRZED eksportu (patrz useApiCosts / migracja 20260924f).
  // Bez tego wielka liczba w panelu nie zgadzala sie z konsola Google - i to ona byla
  // punktem odniesienia Nat (zgloszenie 2026-09-24).
  const { data: manual } = useManualBilling(monthKey);
  const manualAmount = manual?.amount ?? 0;
  const total = due + manualAmount;
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  // ⚠️ Prognoza idzie z TEMPA dni, ktore realnie mamy - dosypanie recznej kwoty sprzed
  // eksportu nie moze jej zawyzac (to koszt juz PONIESIONY, nie przyszly).
  const forecast = coveredDays > 0 ? (due / coveredDays) * getDaysInMonth(now) + manualAmount : 0;
  const syncedAt = rows.length ? rows.reduce((a, r) => (r.synced_at > a ? r.synced_at : a), rows[0].synced_at) : null;

  // Rozbicie na uslugi (Places API, Maps JavaScript API, Geocoding...), netto, malejaco.
  const byService = Array.from(thisMonth.reduce((m, r) => {
    const k = r.service || "(inne)";
    m.set(k, (m.get(k) ?? 0) + r.cost - r.credits);
    return m;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]);
  const maxService = Math.max(0.01, ...byService.map(([, v]) => v));

  const sync = async () => {
    setSyncing(true); setSyncMsg(null);
    const res = await syncGoogleBilling();
    setSyncing(false);
    setSyncMsg(res.ok ? (res.note ?? `Pobrano ${res.rows ?? 0} wierszy`) : `Błąd: ${res.error ?? "nieznany"}`);
    qc.invalidateQueries({ queryKey: ["api-costs", "google-billing"] });
  };

  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5" /> Rachunek Google - {format(now, "LLLL yyyy", { locale: dateLocale() })}
      </h2>
      {isLoading ? <Spin /> : isError ? <Err /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          {rows.length === 0 ? (
            <div className="py-2">
              <p className="text-sm font-semibold text-slate-800">Eksport rozliczeń jeszcze nie dojechał.</p>
              <p className="text-xs text-slate-500 mt-1 leading-snug">
                Google zapisuje pierwsze wiersze kilka godzin po włączeniu eksportu i nie uzupełnia ich wstecz -
                kwoty pojawią się tu od dnia włączenia. Synchronizacja idzie automatycznie raz dziennie o 6:20.
              </p>
            </div>
          ) : (
            <>
              {partialMonth && (
                <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-900">
                    Ten miesiąc jest niepełny - eksport rozliczeń rusza od dnia {firstDay}.
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                    Google nie uzupełnia eksportu wstecz, więc dni {firstDay > 2 ? `1-${firstDay - 1}` : "wcześniejsze"} nie są tu liczone.
                    W Google Cloud zobaczysz za ten miesiąc kwotę WYŻSZĄ - to nie jest błąd panelu.
                    Od następnego miesiąca obie liczby będą się zgadzać.
                  </p>
                  {/* Jedyne uczciwe wyjscie na TEN miesiac: przepisac brakujacy kawalek
                      z konsoli. Cloud Billing API nie oddaje kosztow, a eksport nie cofa sie. */}
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
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-black text-slate-900 tabular-nums">{money(total, cur)}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {manualAmount > 0
                      ? <>do zapłaty w tym miesiącu ({money(due, cur)} z eksportu + {money(manualAmount, cur)} wpisane ręcznie)</>
                      : <>do zapłaty za dni {firstDay}-{lastDay} ({coveredDays} {coveredDays === 1 ? "dzień" : "dni"} w eksporcie)</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-700 tabular-nums">≈ {money(forecast, cur)}</p>
                  <p className="text-xs text-slate-500">prognoza na cały miesiąc</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Cennik katalogowy</p>
                  <p className="font-semibold text-slate-800 tabular-nums mt-0.5">{money(list, cur)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Rabaty i darmowa pula</p>
                  <p className="font-semibold text-emerald-700 tabular-nums mt-0.5">-{money(saved, cur)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Poprzedni miesiąc</p>
                  <p className="font-semibold text-slate-800 tabular-nums mt-0.5">{lastMonth.length ? money(net(lastMonth), cur) : "-"}</p>
                </div>
              </div>

              {byService.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Za co płacimy</p>
                  <div className="space-y-2">
                    {byService.map(([name, v]) => (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">{name}</span>
                          <span className="text-slate-700 font-semibold tabular-nums">{money(v, cur)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-900 rounded-full" style={{ width: `${Math.max(3, Math.round((Math.max(0, v) / maxService) * 100))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <span>
              {syncedAt ? `Zsynchronizowano ${format(parseISO(syncedAt), "d MMM, HH:mm", { locale: dateLocale() })}` : "Brak synchronizacji"}
              {syncMsg ? ` · ${syncMsg}` : ""}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <a href={GOOGLE_BILLING_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
                Google Billing <ExternalLink className="h-3 w-3" />
              </a>
              <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-3 py-1.5 font-semibold disabled:opacity-50">
                <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} /> Odśwież teraz
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TextsearchSection() {
  const { data, isLoading, isError } = useTextsearchMonthly();

  // Biezacy miesiac (UTC) = pierwszy wpis (RPC sortuje malejaco) lub 0 gdy brak wpisu.
  const monthStart = format(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)), "yyyy-MM-dd");
  const current: MonthUsage = data?.find((m) => m.month === monthStart) ?? { month: monthStart, textsearch_calls: 0 };
  const calls = current.textsearch_calls;
  const pct = Math.min(100, Math.round((calls / TEXTSEARCH_MONTHLY_LIMIT) * 100));
  const remaining = Math.max(0, TEXTSEARCH_MONTHLY_LIMIT - calls);
  const blocked = calls >= TEXTSEARCH_MONTHLY_LIMIT;
  const near = !blocked && pct >= 80;

  const barColor = blocked ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500";
  const history = (data ?? []).filter((m) => m.month !== monthStart);

  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5" /> Limit wyszukiwarki (Text Search) - bieżący miesiąc
      </h2>
      <p className="text-xs text-slate-400 -mt-1 mb-3 leading-snug">
        Bezpiecznik kosztowy: po {TEXTSEARCH_MONTHLY_LIMIT.toLocaleString("pl-PL")} wywołaniach proxy przestaje wołać Google do końca miesiąca.
        Sama liczba wywołań nie mówi o koszcie - kwota jest w rachunku wyżej.
      </p>

      {isLoading ? <Spin /> : isError ? <Err /> : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-3xl font-black text-slate-900 tabular-nums">{calls.toLocaleString("pl-PL")}<span className="text-base font-semibold text-slate-400"> / {TEXTSEARCH_MONTHLY_LIMIT.toLocaleString("pl-PL")}</span></p>
                <p className="text-sm text-slate-500 mt-0.5">wywołań w tym miesiącu</p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${blocked ? "bg-red-100 text-red-700" : near ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {blocked ? "LIMIT OSIĄGNIĘTY" : near ? "BLISKO LIMITU" : "OK"}
                </span>
              </div>
            </div>

            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-3">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(2, pct)}%` }} />
            </div>

            <div className="flex justify-between text-xs text-slate-500 mt-2 tabular-nums">
              <span>{calls.toLocaleString("pl-PL")} / {TEXTSEARCH_MONTHLY_LIMIT.toLocaleString("pl-PL")} wywołań ({pct}%)</span>
              <span>{remaining.toLocaleString("pl-PL")} pozostało</span>
            </div>

            {blocked && (
              <p className="text-xs text-red-600 mt-3 leading-snug">
                Wyszukiwarka jest zablokowana do końca miesiąca. Użytkownicy widzą propozycje z bazy zamiast
                wyników Google. Limit zresetuje się 1. dnia następnego miesiąca (UTC).
              </p>
            )}
          </div>

          {history.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Poprzednie miesiące</p>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                {history.map((m) => (
                  <div key={m.month} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-600 capitalize">{format(parseISO(m.month), "LLLL yyyy", { locale: dateLocale() })}</span>
                    <span className="text-slate-500 tabular-nums">
                      <span className="font-semibold text-slate-700">{m.textsearch_calls.toLocaleString("pl-PL")}</span> wywołań
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DailySection() {
  const { data, isLoading, isError } = useDailyGoogleQuota();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayRow = data?.find((d) => d.day === today);
  const calls = todayRow?.google_calls ?? 0;
  const pct = Math.min(100, Math.round((calls / DAILY_CALL_LIMIT) * 100));
  const max = Math.max(1, ...(data ?? []).map((d) => d.google_calls));

  return (
    <section>
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5" /> Wszystkie wywołania Google - dziś
      </h2>
      <p className="text-xs text-slate-400 -mt-1 mb-3 leading-snug">
        Dzienny bezpiecznik (burst) dla wszystkich płatnych wywołań: wyszukiwarka + szczegóły miejsc + zdjęcia.
      </p>
      {isLoading ? <Spin /> : isError ? <Err /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-end justify-between mb-2">
            <p className="text-2xl font-black text-slate-900 tabular-nums">{calls.toLocaleString("pl-PL")}<span className="text-base font-semibold text-slate-400"> / {DAILY_CALL_LIMIT.toLocaleString("pl-PL")}</span></p>
            <span className="text-xs text-slate-500 tabular-nums">{pct}% dziennego limitu</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-slate-900"}`} style={{ width: `${Math.max(2, pct)}%` }} />
          </div>

          {data && data.length > 1 && (
            <div className="mt-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Ostatnie dni</p>
              <div className="space-y-2">
                {data.map((d) => (
                  <div key={d.day}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{format(parseISO(d.day), "d MMM", { locale: dateLocale() })}</span>
                      <span className="text-slate-500 tabular-nums">{d.google_calls.toLocaleString("pl-PL")}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-300 rounded-full" style={{ width: `${Math.max(3, Math.round((d.google_calls / max) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const Spin = () => <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
const Err = () => <p className="text-sm text-red-500 py-8 text-center">Nie udało się wczytać danych o zużyciu.</p>;
