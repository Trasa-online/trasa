import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// PRYMITYWY USTAWIEN (kierunek B z eksploracji, wybor Nat 2026-09-17; makiety w Figmie:
// `[NEW] Ekrany` -> "Ustawienia konta - eksploracja kierunkow").
//
// Do 17.09 ustawienia byly JEDNYM strumieniem pietnastu pozycji z dwoma przypadkowymi
// naglowkami - "Kosz" sasiadowal ze zgoda na analityke, a "Zmien haslo" lezalo pod
// "Zglos blad". Teraz ekran glowny jest SPISEM TRESCI (szesc wierszy), a tresc siedzi
// na podstronach. Te prymitywy trzymaja jeden ksztalt wiersza dla calego drzewa.
//
// ⛔ Kolory z marki: kolko ikony peachy `#FCEDE3`, akcent pomaranczowy, karta profilu zolta.
// Czerwien WYLACZNIE dla wylogowania i usuniecia konta - nigdzie indziej.

export function SettingsScreen({ title, back, children }: {
  title: string;
  /** Dokad wraca chevron, gdy nie ma historii. Brak = ekran glowny ustawien. */
  back?: string;
  children: ReactNode;
}) {
  return (
    // ⚠️ Cel powrotu publikujemy ATRYBUTEM, a nie przez kontekst - chevron zyje w gornej
    // belce (`TopBar`), ktora stoi NAD ekranem i nie zna jego propsow. Ten sam wzorzec,
    // co `data-scroll-main`: ekran sie OZNACZA, a belka pyta o niego DOM. Dzieki temu
    // podstrona bez historii (wejscie z linku) wraca o jeden poziom wyzej, a nie na profil.
    <div data-settings-back={back ?? "/moj-profil"} className="pb-[calc(3rem+env(safe-area-inset-bottom,0px))]">
      {/* ⚠️ TYLKO TYTUL - strzalka wstecz zyje w GORNEJ BELCE (`TopBar`), gdzie od 2026-09-17
          zastapila awatar. Dwie strzalki jedna nad druga to byly dwa wejscia do tej samej
          czynnosci w odleglosci 40 px. Podstrony ustawien wracaja przez ta sama belke, wiec
          prop `back` zostaje w sygnaturze (uzywa go `goBackOr` jako zapasowy cel), tylko nie
          rysuje juz wlasnego guzika. */}
      <div className="flex items-center gap-2 px-4 pt-2 pb-1">
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
      <div className="px-4 pt-2 pb-4 space-y-5 max-w-lg mx-auto">{children}</div>
    </div>
  );
}

/** Etykieta grupy: 11 px wersaliki w szarosci. Grupa BEZ etykiety jest w porzadku - pusta
 *  szufladka z nazwa nie jest. */
export function SettingsGroup({ label, children, note }: { label?: string; children: ReactNode; note?: string }) {
  return (
    <div className="space-y-2">
      {label && <p className="px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>}
      <div className="overflow-hidden rounded-[20px] bg-muted/60">{children}</div>
      {note && <p className="px-3 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Wiersz ustawienia. Koniec wiersza mowi, CO SIE STANIE:
 *  - chevron = prowadzi dalej (podstrona, arkusz),
 *  - `state` albo `right` = zmienia sie tu i teraz (przelacznik, wybrany jezyk, stan zgody).
 *  Do 17.09 obie rzeczy wygladaly tak samo i nie dalo sie zgadnac, ktore ustawienie juz
 *  zadzialalo, a ktore czeka na guzik. */
export function SettingsRow({ icon, label, desc, badge, state, right, danger, onClick, disabled }: {
  icon?: ReactNode;
  label: string;
  desc?: string;
  badge?: string;
  state?: string;
  right?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const inner = (
    <>
      {icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FCEDE3] text-primary">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-medium ${danger ? "text-destructive" : "text-foreground"}`}>{label}</span>
        {desc && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{desc}</span>}
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-[#FDF184] px-2 py-0.5 text-[10px] font-bold uppercase text-[#5B2C06]">{badge}</span>
      )}
      {state && <span className="shrink-0 text-sm text-muted-foreground">{state}</span>}
      {right}
      {onClick && !right && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors min-h-[52px] border-b border-border/25 last:border-b-0";
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${cls} active:bg-muted disabled:opacity-60`}>
      {inner}
    </button>
  );
}

/** Akcja nieodwracalna stoi we WLASNEJ karcie, odsunieta od reszty (wzor: PayPal).
 *  Wyloguj i usun konto nie moga mieszkac w tej samej szufladzie co przelacznik analityki. */
export function SettingsActionCard({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[20px] bg-muted/60 py-4 text-center text-[15px] font-bold text-destructive transition-colors active:bg-muted disabled:opacity-60"
    >
      {label}
    </button>
  );
}
