import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAdmin } from "./RequireAdmin";
import { AdminLayout } from "./layout/AdminLayout";
import { ModerationQueue } from "./modules/moderation/ModerationQueue";
import { AnalyticsPage } from "./modules/analytics/AnalyticsPage";
import { UsersPage } from "./modules/users/UsersPage";
import { OpsPage } from "./modules/ops/OpsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";

// Panel operacyjny - wszystkie 4 moduly MVP aktywne (moderacja, users,
// analityka, zgloszenia+miasta).
export default function AdminApp() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/moderacja" replace />} />
          <Route path="/moderacja" element={<ModerationQueue />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/analityka" element={<AnalyticsPage />} />
          <Route path="/ops" element={<OpsPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/moderacja" replace />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}
