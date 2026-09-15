// Jedna szerokosc tresci dla calego panelu. Do 15.09.2026 zyly trzy rozne max-w-*,
// przez co tresc skakala przy zmianie zakladki.
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-width)] flex-col gap-5 px-4 py-6 sm:px-6 md:px-8">
      {children}
    </div>
  );
}
