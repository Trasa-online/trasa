import { toast } from "sonner";

// notify deleguje do natywnych toastow Sonnera - wyglad (kolory kategorii, ikona
// w bialym kole, przycisk zamkniecia) jest skonfigurowany globalnie w
// src/components/ui/sonner.tsx. Dzieki temu notify.* i goly toast.* w calej apce
// wygladaja identycznie. Sygnatura (title, description?) mapuje na opcje Sonnera.
type Opt = (title: string, description?: string) => string | number;

const wrap = (fn: (msg: string, opts?: { description?: string }) => string | number): Opt =>
  (title, description) => fn(title, description ? { description } : undefined);

export const notify = {
  success: wrap(toast.success),
  warning: wrap(toast.warning),
  error: wrap(toast.error),
  info: wrap(toast.info),
};
