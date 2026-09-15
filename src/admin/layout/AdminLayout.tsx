import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "../RequireAdmin";
import { WaitlistPeek } from "./WaitlistPeek";
import { CommandPalette } from "./CommandPalette";
import { useAdminPending } from "../modules/home/useAdminHome";
import { useUnreadThreads } from "../modules/messages/useMessages";
import { cn } from "@/lib/utils";
import {
  Inbox, Users, MapPin, ListChecks, BarChart3, DollarSign,
  ScrollText, Settings, Menu, X, Home, Search, Store, MessageCircle,
} from "lucide-react";

// Nawigacja: 11 plaskich pozycji -> 4 grupy (decyzja z briefu, 15.09.2026).
// Grupa niesie znaczenie: "czy to jest praca do zrobienia, czy tylko podglad".
// Moderacja B2C, B2B, Flagi i Zgloszenia znikly jako osobne adresy - to sa teraz
// FILTRY jednej kolejki, bo to ta sama czynnosc.
const GROUPS: { label?: string; items: { to: string; label: string; icon: typeof Inbox; badge?: boolean; chat?: boolean }[] }[] = [
  { items: [
    { to: "/", label: "Dziś", icon: Home },
    { to: "/kolejka", label: "Kolejka", icon: Inbox, badge: true },
    // Rozmowy z lokalami. Osobno od kolejki, bo to nie jest sprawa do rozpatrzenia,
    // tylko ktos, kto czeka na odpowiedz.
    { to: "/rozmowy", label: "Rozmowy", icon: MessageCircle, chat: true },
  ] },
  { label: "Dane", items: [
    { to: "/users", label: "Użytkownicy", icon: Users },
    { to: "/miejsca", label: "Miejsca", icon: MapPin },
    { to: "/wizytowki", label: "Wizytówki", icon: Store },
    { to: "/zestawienia", label: "Leady", icon: ListChecks },
  ] },
  { label: "Liczby", items: [
    { to: "/analityka", label: "Analityka", icon: BarChart3 },
    { to: "/koszty", label: "Koszty API", icon: DollarSign },
  ] },
  { label: "System", items: [
    { to: "/audyt", label: "Audyt", icon: ScrollText },
    { to: "/ustawienia", label: "Ustawienia", icon: Settings },
  ] },
];

function NavItems({ onNavigate, pending, chatWaiting }: { onNavigate?: () => void; pending?: number; chatWaiting?: number }) {
  return (
    <>
      {GROUPS.map((g, gi) => (
        <div key={gi} className={cn(gi > 0 && "pt-4")}>
          {g.label ? (
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.7px] text-[var(--stone)]">{g.label}</p>
          ) : null}
          {g.items.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) => cn(
                  "flex items-center gap-2.5 rounded-[var(--r-control)] px-2.5 py-2 text-[13px] transition-colors",
                  isActive
                    ? "bg-[var(--accent)] font-semibold text-[var(--on-accent)]"
                    : "text-[var(--graphite)] hover:bg-[var(--canvas)]",
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[var(--on-accent)]" : "text-[var(--stone)]")} />
                    <span className="flex-1 truncate">{n.label}</span>
                    {n.badge && pending ? (
                      <span className={cn("data text-[11px]", isActive ? "text-[var(--on-accent)]" : "text-[var(--stone)]")}>{pending}</span>
                    ) : null}
                    {n.chat && chatWaiting ? (
                      <span className={cn("data text-[11px]", isActive ? "text-[var(--on-accent)]" : "text-[var(--accent)]")}>{chatWaiting}</span>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Mark() {
  // Zolty znak "S" to JEDYNE miejsce w panelu, gdzie uzywamy zoltego marki.
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--r-control)] bg-[var(--ink)] text-[13px] font-semibold text-[var(--brand-yellow)]">S</span>
      <span className="text-[14px] font-semibold text-[var(--ink)]">spontaway ops</span>
    </span>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { email } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pending = useAdminPending();
  const total = pending.data?.total;
  const chatWaiting = useUnreadThreads();

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen(true)}
            className="-ml-1 rounded-[var(--r-control)] p-1.5 text-[var(--graphite)] hover:bg-[var(--canvas)] md:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Mark />
        </div>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-[360px] items-center gap-2 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--stone)] shadow-[var(--shadow-inset)] hover:bg-[var(--canvas)]"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-left text-[12px]">Skocz do modułu albo filtra kolejki</span>
            <span className="data text-[10px]">⌘K</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <WaitlistPeek />
          <span className="data hidden text-[11px] text-[var(--stone)] sm:inline">{email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-[12px] font-medium text-[var(--stone)] hover:text-[var(--ink)]"
          >
            Wyloguj
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/45" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-0 left-0 top-0 flex w-72 flex-col gap-0.5 overflow-y-auto border-r border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="mb-2 flex h-11 items-center justify-between px-1.5">
              <Mark />
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-[var(--r-control)] p-1.5 text-[var(--stone)] hover:bg-[var(--canvas)]"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setMenuOpen(false)} pending={total} chatWaiting={chatWaiting} />
          </div>
        </div>
      )}

      <div className="flex">
        <aside className="hidden w-60 shrink-0 flex-col gap-0.5 border-r border-[var(--line)] bg-[var(--surface)] p-3 md:flex md:min-h-[calc(100vh-3.5rem)]">
          <NavItems pending={total} chatWaiting={chatWaiting} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
