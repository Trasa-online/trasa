// Karta sprawy w kolejce. Jedno obramowanie i jeden promien dla wszystkich paneli.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4", className)}>
      {children}
    </div>
  );
}
