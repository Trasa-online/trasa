import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAdmin } from "./RequireAdmin";
import { AdminLayout } from "./layout/AdminLayout";
import { ModerationB2CPage } from "./modules/moderation-b2c/ModerationB2CPage";
import { ModerationPage } from "./modules/moderation/ModerationPage";
import { AnalyticsPage } from "./modules/analytics/AnalyticsPage";
import { UsersPage } from "./modules/users/UsersPage";
import { OpsPage } from "./modules/ops/OpsPage";
import { CostsPage } from "./modules/costs/CostsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { LeadsPage } from "./modules/leads/LeadsPage";
import { PlacesPage } from "./modules/places/PlacesPage";
import { PlaceFlagsPage } from "./modules/flags/PlaceFlagsPage";
import { AuditPage } from "./modules/audit/AuditPage";

// Panel operacyjny - wszystkie 4 moduly MVP aktywne (moderacja, users,
// analityka, zgloszenia+miasta).
export default function AdminApp() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/moderacja/b2c" replace />} />
          <Route path="/moderacja" element={<Navigate to="/moderacja/b2c" replace />} />
          <Route path="/moderacja/b2c" element={<ModerationB2CPage />} />
          <Route path="/moderacja/b2b" element={<ModerationPage />} />
          <Route path="/zestawienia" element={<LeadsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/analityka" element={<AnalyticsPage />} />
          <Route path="/miejsca" element={<PlacesPage />} />
          <Route path="/flagi" element={<PlaceFlagsPage />} />
          <Route path="/ops" element={<OpsPage />} />
          <Route path="/koszty" element={<CostsPage />} />
          <Route path="/audyt" element={<AuditPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}
