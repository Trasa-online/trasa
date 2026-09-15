// Jedna kolejka zamiast czterech adresow. `/moderacja/b2c`, `/moderacja/b2b`, `/flagi`
// i `/ops` znikly z nawigacji i sa tutaj FILTRAMI - to jest ta sama czynnosc:
// spojrz, zdecyduj, nastepna.
//
// ⚠️ Chip wybiera ZRODLO i renderuje jego panel. Wspolny strumien wszystkich typow
// w jednej liscie wymaga hooka laczacego siedem zapytan (i wspolnego ksztaltu sprawy)
// - wchodzi osobno, a do tego czasu nic z funkcjonalnosci nie ginie.
import { useSearchParams } from "react-router-dom";
import { AppShell, PageHeader, FilterChips, type Chip } from "../../ui";
import { useAdminPending } from "../home/useAdminHome";
import { QuarantinePanel, ReportsPanel } from "../moderation-b2c/ReportPanels";
import { CollectionsPanel, TripsPanel } from "../moderation-b2c/UgcPanels";
import { ModerationQueue } from "../moderation/ModerationQueue";
import { PlaceFlagsPage } from "../flags/PlaceFlagsPage";
import { OpsPage } from "../ops/OpsPage";

const TYPES = ["zdjecia", "zgloszenia", "kolekcje", "wizytowki", "wyjazdy", "flagi", "bledy"] as const;
type QueueType = (typeof TYPES)[number];

export function QueuePage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("typ") as QueueType | null;
  const active: QueueType = raw && (TYPES as readonly string[]).includes(raw) ? raw : "zdjecia";
  const pending = useAdminPending();

  // "Wyjazdy" nie maja licznika: opublikowany wyjazd nie czeka na decyzje, tylko moze
  // zostac ukryty. Doklejenie tam liczby wszystkich wyjazdow udawaloby backlog.
  const chips: Chip[] = [
    { id: "zdjecia", label: "Zdjęcia", count: pending.data?.quarantine },
    { id: "zgloszenia", label: "Zgłoszenia", count: pending.data?.reports },
    { id: "kolekcje", label: "Kolekcje", count: pending.data?.collections },
    { id: "wizytowki", label: "Wizytówki", count: pending.data?.business },
    { id: "wyjazdy", label: "Wyjazdy" },
    { id: "flagi", label: "Flagi", count: pending.data?.flags },
    { id: "bledy", label: "Błędy", count: pending.data?.bugs },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Kolejka"
        subtitle={typeof pending.data?.total === "number"
          ? `${pending.data.total} spraw czeka na decyzję.`
          : "Wszystko, co czeka na decyzję, w jednym miejscu."}
      />
      <FilterChips chips={chips} value={active} onChange={(id) => setParams({ typ: id }, { replace: true })} />
      <div>
        {active === "zdjecia" && <QuarantinePanel />}
        {active === "zgloszenia" && <ReportsPanel />}
        {active === "kolekcje" && <CollectionsPanel />}
        {active === "wizytowki" && <ModerationQueue />}
        {active === "wyjazdy" && <TripsPanel />}
        {active === "flagi" && <PlaceFlagsPage />}
        {active === "bledy" && <OpsPage />}
      </div>
    </AppShell>
  );
}
