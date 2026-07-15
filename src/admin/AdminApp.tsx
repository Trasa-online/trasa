import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAdmin } from "./RequireAdmin";
import { AdminLayout } from "./layout/AdminLayout";
import { ModerationQueue } from "./modules/moderation/ModerationQueue";

// Panel operacyjny. Modul moderacji dziala; pozostale (users/analityka/ops)
// dochodza w kolejnych fazach - na razie placeholdery.
export default function AdminApp() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/moderacja" replace />} />
          <Route path="/moderacja" element={<ModerationQueue />} />
          <Route path="/users" element={<Placeholder title="Użytkownicy + waitlist" />} />
          <Route path="/analityka" element={<Placeholder title="Analityka" />} />
          <Route path="/ops" element={<Placeholder title="Zgłoszenia + miasta" />} />
          <Route path="*" element={<Navigate to="/moderacja" replace />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-black text-slate-900 mb-2">{title}</h1>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-4xl mb-2">🚧</p>
        <p className="text-slate-600 font-semibold">Moduł w przygotowaniu</p>
        <p className="text-sm text-slate-400 mt-1">Dochodzi w kolejnej fazie - najpierw moderacja biznesów.</p>
      </div>
    </div>
  );
}
