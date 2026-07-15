import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrasaLogo } from "@/components/TrasaLogo";
import { RequireAdmin, useAdmin } from "./RequireAdmin";

// Szkielet panelu operacyjnego (FUNDAMENT). Moduly (moderacja, users, analityka,
// ops) dochodza w kolejnych fazach - tu na razie "hello admin" potwierdzajacy,
// ze subdomena + auth + gate roli + tier dzialaja end-to-end.
export default function AdminApp() {
  return (
    <RequireAdmin>
      <Routes>
        <Route path="/" element={<HelloAdmin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RequireAdmin>
  );
}

function HelloAdmin() {
  const { email, tier, roles } = useAdmin();
  const isSuper = tier === "super_admin";
  return (
    <div className="min-h-screen bg-[#F4F4F5]" style={{ backgroundImage: "radial-gradient(rgba(15,23,42,0.06) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      <header className="flex items-center justify-between px-6 h-16 border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <TrasaLogo size={32} />
          <span className="text-sm font-black text-slate-800">trasa<span className="text-orange-600"> ops</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{email}</span>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${isSuper ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
            {isSuper ? "super-admin" : "operator"}
          </span>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-500 hover:text-slate-800 font-medium">
            Wyloguj
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h1 className="text-2xl font-black text-slate-900 mb-2">Panel operacyjny działa 🎉</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Fundament gotowy: subdomena, logowanie zespołu, bramka roli i tier ({tier}). Moduły dochodzą w kolejnych fazach.
          </p>
          <div className="grid gap-3">
            <ModuleRow title="Moderacja biznesów" desc="SLA < 24h · akcept/odrzut wizytówek" tag="następny" />
            <ModuleRow title="Użytkownicy + waitlist" desc="konta, zaproszenia, soft-delete" />
            <ModuleRow title="Analityka" desc="KPI produktowe i operacyjne" />
            <ModuleRow title="Bugi + miasta" desc="zgłoszenia i prośby o miasta" />
          </div>
          <p className="text-[11px] text-slate-400 mt-6">Twoje role: {roles.join(", ") || "—"}</p>
        </div>
      </main>
    </div>
  );
}

function ModuleRow({ title, desc, tag }: { title: string; desc: string; tag?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      {tag && <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold">{tag}</span>}
    </div>
  );
}
