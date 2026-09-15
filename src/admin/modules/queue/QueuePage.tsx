// Jedna kolejka zamiast czterech adresow. `/moderacja/b2c`, `/moderacja/b2b`, `/flagi`
// i `/ops` znikly z nawigacji i sa tutaj FILTRAMI - to jest ta sama czynnosc:
// spojrz, zdecyduj, nastepna.
//
// ⚠️ Pierwszy etap: chip wybiera ZRODLO i renderuje jego panel. Wspolny strumien
// wszystkich typow w jednej liscie wymaga nowego hooka laczacego siedem zapytan
// i wchodzi osobno - do tego czasu nic z dotychczasowej funkcjonalnosci nie ginie.
import { useSearchParams } from "react-router-dom";
import { AppShell, PageHeader, FilterChips, type Chip } from "../../ui";
import { useAdminPending } from "../home/useAdminHome";
import { QuarantinePanel, ReportsPanel } from "../moderation-b2c/ReportPanels";
import { ModerationQueue } from "../moderation/ModerationQueue";
import { PlaceFlagsPage } from "../flags/PlaceFlagsPage";
import { OpsPage } from "../ops/OpsPage";

const TYPES = ["zdjecia", "zgloszenia", "wizytowki", "flagi", "bledy"] as const;
type QueueType = (typeof TYPES)[number];

export function QueuePage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("typ") as QueueType | null;
  const active: QueueType = raw && (TYPES as readonly string[]).includes(raw) ? raw : "zdjecia";
  const pending = useAdminPending();

  const chips: Chip[] = [
    { id: "zdjecia", label: "Zdjęcia", count: pending.data?.quarantine },
    { id: "zgloszenia", label: "Zgłoszenia", count: pending.data?.reports },
    { id: "wizytowki", label: "Wizytówki", count: pending.data?.business },
    { id: "flagi", label: "Flagi", count: pending.data?.flags },
    { id: "bledy", label: "Błędy", count: pending.data?.bugs },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Kolejka"
        subtitle={typeof pending.data?.total === "number"
          ? `${pending.data.total} spraw czeka na decyzję.`
          : "Wszystko, co czeka na decyzję, w jednym miejscu."}
      />
      <FilterChips chips={chips} value={active} onChange={(id) => setParams({ typ: id }, { replace: true })} />
      <div>
        {active === "zdjecia" && <QuarantinePanel />}
        {active === "zgloszenia" && <ReportsPanel />}
        {active === "wizytowki" && <ModerationQueue />}
        {active === "flagi" && <PlaceFlagsPage />}
        {active === "bledy" && <OpsPage />}
      </div>
    </AppShell>
  );
}
