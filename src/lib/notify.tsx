import { toast } from "sonner";

// notify deleguje do natywnych toastow Sonnera - wyglad (kolory kategorii, ikona
// w bialym kole, przycisk zamkniecia) jest skonfigurowany globalnie w
// src/components/ui/sonner.tsx. Dzieki temu notify.* i goly toast.* w calej apce
// wygladaja identycznie. Sygnatura (title, description?) mapuje na opcje Sonnera.
type Position = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
// position pozwala wyswietlic toast nad bottom-sheet modalem (top-center), zeby sie nie
// nakladal - domyslnie globalny bottom-center z sonner.tsx.
type Extra = { position?: Position };
type Opt = (title: string, description?: string, extra?: Extra) => string | number;

const wrap = (fn: (msg: string, opts?: { description?: string; position?: Position }) => string | number): Opt =>
  (title, description, extra) => fn(title, { ...(description ? { description } : {}), ...(extra ?? {}) });

export const notify = {
  success: wrap(toast.success),
  warning: wrap(toast.warning),
  error: wrap(toast.error),
  info: wrap(toast.info),
};
