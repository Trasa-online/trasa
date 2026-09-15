import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAdmin } from "./RequireAdmin";
import { AdminLayout } from "./layout/AdminLayout";
import { HomePage } from "./modules/home/HomePage";
import { QueuePage } from "./modules/queue/QueuePage";
import { AnalyticsPage } from "./modules/analytics/AnalyticsPage";
import { UsersPage } from "./modules/users/UsersPage";
import { CostsPage } from "./modules/costs/CostsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { LeadsPage } from "./modules/leads/LeadsPage";
import { PlacesPage } from "./modules/places/PlacesPage";
import { BusinessesPage } from "./modules/businesses/BusinessesPage";
import { AuditPage } from "./modules/audit/AuditPage";

// Panel operacyjny. Nawigacja: Dzis, Kolejka, Dane, Liczby, System (przebudowa 15.09.2026).
//
// Stare adresy moderacji ZOSTAJA jako przekierowania z ustawionym filtrem - zakladki
// w przegladarce i linki w mailach maja dalej dzialac, tylko ladowac w jednej kolejce.
export default function AdminApp() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/kolejka" element={<QueuePage />} />

          <Route path="/moderacja" element={<Navigate to="/kolejka" replace />} />
          <Route path="/moderacja/b2c" element={<Navigate to="/kolejka?typ=zdjecia" replace />} />
          <Route path="/moderacja/b2b" element={<Navigate to="/kolejka?typ=wizytowki" replace />} />
          <Route path="/flagi" element={<Navigate to="/kolejka?typ=flagi" replace />} />
          <Route path="/ops" element={<Navigate to="/kolejka?typ=bledy" replace />} />

          <Route path="/users" element={<UsersPage />} />
          <Route path="/miejsca" element={<PlacesPage />} />
          <Route path="/wizytowki" element={<BusinessesPage />} />
          <Route path="/zestawienia" element={<LeadsPage />} />
          <Route path="/analityka" element={<AnalyticsPage />} />
          <Route path="/koszty" element={<CostsPage />} />
          <Route path="/audyt" element={<AuditPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}
