// Karta sprawy w kolejce. Jedno obramowanie i jeden promien dla wszystkich paneli.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className, padded = true }: {
  children: ReactNode;
  className?: string;
  /** false = tresc sama rysuje swoje marginesy (lista z separatorami, rozmowa). */
  padded?: boolean;
}) {
  return (
    <div className={cn("rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]", padded && "p-4", className)}>
      {children}
    </div>
  );
}
