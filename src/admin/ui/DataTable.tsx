// Tabela danych. Zastepuje reczne tabele i listy w Uzytkownikach, Miejscach, Leadach i Audycie.
//
// ⚠️ Ponizej `md` tabela NIE jest zwezana, tylko zmienia postac na karty rekordow.
// Siedem kolumn na 390 px dalo by przewijanie w poziomie, a robota polega na skanowaniu
// wzrokiem i decydowaniu - przewijanie w bok ja zabija.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loading } from "./Loading";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  label: string;
  /** Szerokosc w px na desktopie. Brak = kolumna rozciagliwa. */
  width?: number;
  align?: "right";
  render: (row: T) => ReactNode;
  /** Tytul karty na mobile (bez etykiety). Dokladnie jedna kolumna powinna to miec. */
  primary?: boolean;
  /** Druga linia pod tytulem na mobile, tez bez etykiety. */
  secondary?: boolean;
  /** Nie pokazuj na mobile - np. kolumna akcji, ktora ma wlasne miejsce w karcie. */
  hideOnMobile?: boolean;
}

export function DataTable<T>({ columns, rows, keyOf, loading, empty, onRowClick }: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  loading?: boolean;
  empty?: { fact: string; next: string };
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <Loading />;
  if (!rows.length) {
    return (
      <div className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]">
        <EmptyState
          fact={empty?.fact ?? "Nic tu nie ma."}
          next={empty?.next ?? "Zmień filtry albo wróć później."}
        />
      </div>
    );
  }

  const primary = columns.find((c) => c.primary);
  const secondary = columns.find((c) => c.secondary);
  const rest = columns.filter((c) => !c.primary && !c.secondary && !c.hideOnMobile);

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] md:block">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.7px] text-[var(--stone)]",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-[var(--line)] last:border-0",
                  onRowClick && "cursor-pointer hover:bg-[var(--canvas)]",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 align-middle text-[13px] text-[var(--graphite)]", c.align === "right" && "text-right")}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: ten sam zestaw kolumn, inna postac */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map((row) => (
          <div
            key={keyOf(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-3.5"
          >
            {primary ? <div className="text-[14px] font-semibold text-[var(--ink)]">{primary.render(row)}</div> : null}
            {secondary ? <div className="mt-0.5 text-[12px] text-[var(--stone)]">{secondary.render(row)}</div> : null}
            {rest.length ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[10px] text-[var(--stone)]">{c.label}</dt>
                    <dd className="mt-px truncate text-[13px] text-[var(--ink)]">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {columns.filter((c) => c.hideOnMobile).map((c) => (
              <div key={c.key} className="mt-3">{c.render(row)}</div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
