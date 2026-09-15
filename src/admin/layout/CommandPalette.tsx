// Paleta polecen (⌘K / Ctrl+K). Do 15.09.2026 w belce stala ATRAPA pola szukania
// z podpowiedzia skrotu, ktory nic nie robil - to jest jej dzialajaca wersja.
//
// Zakres celowo waski: skok do modulu i do filtra kolejki. Szukanie po TRESCI
// (konkretny lokal, konkretne konto) zyje w module, ktory ma do tego zapytanie.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

interface Cmd { to: string; label: string; group: string }

const COMMANDS: Cmd[] = [
  { to: "/", label: "Dziś", group: "Panel" },
  { to: "/kolejka", label: "Kolejka", group: "Panel" },
  { to: "/kolejka?typ=zdjecia", label: "Kolejka: zdjęcia", group: "Kolejka" },
  { to: "/kolejka?typ=zgloszenia", label: "Kolejka: zgłoszenia", group: "Kolejka" },
  { to: "/kolejka?typ=kolekcje", label: "Kolejka: kolekcje", group: "Kolejka" },
  { to: "/kolejka?typ=wizytowki", label: "Kolejka: wizytówki", group: "Kolejka" },
  { to: "/kolejka?typ=wyjazdy", label: "Kolejka: wyjazdy", group: "Kolejka" },
  { to: "/kolejka?typ=flagi", label: "Kolejka: flagi", group: "Kolejka" },
  { to: "/kolejka?typ=bledy", label: "Kolejka: błędy", group: "Kolejka" },
  { to: "/users", label: "Użytkownicy", group: "Dane" },
  { to: "/miejsca", label: "Miejsca", group: "Dane" },
  { to: "/wizytowki", label: "Wizytówki", group: "Dane" },
  { to: "/zestawienia", label: "Leady", group: "Dane" },
  { to: "/analityka", label: "Analityka", group: "Liczby" },
  { to: "/koszty", label: "Koszty API", group: "Liczby" },
  { to: "/audyt", label: "Audyt", group: "System" },
  { to: "/ustawienia", label: "Ustawienia", group: "System" },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);

  // Skrot dziala z kazdego miejsca panelu, takze gdy paleta jest zamknieta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  useEffect(() => { if (open) { setQ(""); setCursor(0); } }, [open]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COMMANDS;
    return COMMANDS.filter((c) => `${c.group} ${c.label}`.toLowerCase().includes(needle));
  }, [q]);

  if (!open) return null;

  const go = (to: string) => { onOpenChange(false); navigate(to); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onOpenChange(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    if (e.key === "Enter" && hits[cursor]) { e.preventDefault(); go(hits[cursor].to); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]">
        <label className="flex h-12 items-center gap-2 border-b border-[var(--line)] px-4">
          <Search className="h-4 w-4 shrink-0 text-[var(--stone)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Skocz do modułu albo filtra kolejki"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
          />
        </label>
        <div className="max-h-[52vh] overflow-y-auto py-1">
          {hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--stone)]">
              Nic takiego nie ma w panelu. Spróbuj „kolejka”, „koszty” albo „audyt”.
            </p>
          ) : hits.map((c, i) => (
            <button
              key={c.to}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(c.to)}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] ${
                i === cursor ? "bg-[var(--canvas)] text-[var(--ink)]" : "text-[var(--graphite)]"
              }`}
            >
              <span className="flex-1 truncate">{c.label}</span>
              <span className="data text-[10px] text-[var(--stone)]">{c.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
