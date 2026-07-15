import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrasaLogo } from "@/components/TrasaLogo";
import { useAdmin } from "../RequireAdmin";
import { ShieldCheck, Users, BarChart3, Bug, Settings } from "lucide-react";

const NAV = [
  { to: "/moderacja", label: "Moderacja", icon: ShieldCheck, ready: true },
  { to: "/users", label: "Użytkownicy", icon: Users, ready: true },
  { to: "/analityka", label: "Analityka", icon: BarChart3, ready: true },
  { to: "/ops", label: "Zgłoszenia", icon: Bug, ready: true },
  { to: "/ustawienia", label: "Ustawienia", icon: Settings, ready: true },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { email, tier } = useAdmin();
  const isSuper = tier === "super_admin";

  return (
    <div className="min-h-screen bg-[#F4F4F5]" style={{ backgroundImage: "radial-gradient(rgba(15,23,42,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      {/* Topbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 h-14 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <TrasaLogo size={30} />
          <span className="text-sm font-black text-slate-800">trasa<span className="text-orange-600"> ops</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-500">{email}</span>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${isSuper ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
            {isSuper ? "super-admin" : "operator"}
          </span>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-500 hover:text-slate-800 font-medium">Wyloguj</button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-slate-200 min-h-[calc(100vh-3.5rem)] p-3 gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            if (!n.ready) {
              return (
                <div key={n.to} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 cursor-not-allowed">
                  <Icon className="h-4 w-4" />
                  {n.label}
                  <span className="ml-auto text-[10px] font-bold text-slate-300">wkrótce</span>
                </div>
              );
            }
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? "bg-orange-600 text-white shadow-sm shadow-orange-600/20" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            );
          })}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
