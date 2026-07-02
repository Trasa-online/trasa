import { toast } from "sonner";

// Odroczone usuwanie z oknem "Cofnij" (undo w stylu Gmaila). Wzorzec:
//   1) Caller robi optymistyczna zmiane UI (ukrywa/usuwa element z listy) PRZED wywolaniem.
//   2) deferDelete pokazuje toast z akcja "Cofnij" i ODRACZA faktyczny commit (DB delete) o delayMs.
//   3) Klik "Cofnij" -> anuluje timer i wola onUndo (przywrocenie UI). Brak klikniecia -> po delayMs
//      odpala commit (nieodwracalne usuniecie). Zastepuje confirm() - nic nie ginie przez okno undo.
//
// Uwaga: jesli apka zostanie zamknieta przed delayMs, timer moze nie odpalic commitu - element
// wroci przy nastepnym odczycie (bezpieczne: usuniecie nie jest jeszcze utrwalone).
export function deferDelete(opts: {
  message: string;
  commit: () => void | Promise<void>;
  onUndo?: () => void;
  delayMs?: number;
}): void {
  const delay = opts.delayMs ?? 5000;
  let committed = false;
  const timer = setTimeout(() => {
    committed = true;
    void opts.commit();
  }, delay);
  toast(opts.message, {
    duration: delay,
    action: {
      label: "Cofnij",
      onClick: () => {
        if (committed) return; // za pozno - commit juz poszedl
        clearTimeout(timer);
        opts.onUndo?.();
      },
    },
  });
}
