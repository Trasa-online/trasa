import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAdmin } from "./RequireAdmin";
import { AdminLayout } from "./layout/AdminLayout";
import { ModerationPage } from "./modules/moderation/ModerationPage";
import { AnalyticsPage } from "./modules/analytics/AnalyticsPage";
import { UsersPage } from "./modules/users/UsersPage";
import { OpsPage } from "./modules/ops/OpsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { RankingsPage } from "./modules/rankings/RankingsPage";
import { PlacesPage } from "./modules/places/PlacesPage";
import { AuditPage } from "./modules/audit/AuditPage";

// Panel operacyjny - wszystkie 4 moduly MVP aktywne (moderacja, users,
// analityka, zgloszenia+miasta).
export default function AdminApp() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/moderacja" replace />} />
          <Route path="/moderacja" element={<ModerationPage />} />
          <Route path="/zestawienia" element={<RankingsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/analityka" element={<AnalyticsPage />} />
          <Route path="/miejsca" element={<PlacesPage />} />
          <Route path="/ops" element={<OpsPage />} />
          <Route path="/audyt" element={<AuditPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/moderacja" replace />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}
