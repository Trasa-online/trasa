// Pasek nad trescia: szukanie, filtry, licznik. Zastepuje reczne rzedy w kazdym module.
import type { ReactNode } from "react";
import { Search } from "lucide-react";

export function Toolbar({ search, onSearch, placeholder = "Szukaj", children, count }: {
  search?: string; onSearch?: (v: string) => void; placeholder?: string;
  children?: ReactNode; count?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearch ? (
        <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 shadow-[var(--shadow-inset)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--stone)]" />
          <input
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
          />
        </label>
      ) : null}
      {children}
      {count ? <span className="data ml-auto text-[12px] text-[var(--stone)]">{count}</span> : null}
    </div>
  );
}
