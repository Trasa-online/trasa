import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrasaLogo } from "@/components/TrasaLogo";
import { useAdmin } from "../RequireAdmin";
import { ShieldCheck, Users, BarChart3, Bug, Settings, ListChecks, MapPin, ScrollText, Menu, X } from "lucide-react";

const NAV = [
  { to: "/moderacja", label: "Moderacja", icon: ShieldCheck },
  { to: "/zestawienia", label: "Zestawienia", icon: ListChecks },
  { to: "/users", label: "Użytkownicy", icon: Users },
  { to: "/analityka", label: "Analityka", icon: BarChart3 },
  { to: "/miejsca", label: "Miejsca", icon: MapPin },
  { to: "/ops", label: "Zgłoszenia", icon: Bug },
  { to: "/audyt", label: "Audyt", icon: ScrollText },
  { to: "/ustawienia", label: "Ustawienia", icon: Settings },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((n) => {
        const Icon = n.icon;
        return (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive ? "bg-slate-900 text-white shadow-sm shadow-slate-900/20" : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {n.label}
          </NavLink>
        );
      })}
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { email, tier } = useAdmin();
  const isSuper = tier === "super_admin";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F4F5]" style={{ backgroundImage: "radial-gradient(rgba(15,23,42,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      {/* Topbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-5 h-14 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={() => setMenuOpen(true)} className="md:hidden -ml-1 p-1.5 rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <TrasaLogo size={30} />
          <span className="text-sm font-black text-slate-800">trasa<span className="text-slate-700"> ops</span></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-xs text-slate-500">{email}</span>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${isSuper ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
            {isSuper ? "super-admin" : "operator"}
          </span>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-500 hover:text-slate-800 font-medium">Wyloguj</button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 p-3 flex flex-col gap-1 shadow-xl">
            <div className="flex items-center justify-between px-2 h-11 mb-1">
              <span className="text-sm font-black text-slate-800">trasa<span className="text-slate-700"> ops</span></span>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zamknij"><X className="h-5 w-5" /></button>
            </div>
            <NavItems onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-slate-200 min-h-[calc(100vh-3.5rem)] p-3 gap-1">
          <NavItems />
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
