import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { haptics } from "@/hooks/useHaptics";

// Plywajace akcje wyjazdu schowane pod JEDNYM guzikiem (prosba Nat 2026-09-10).
//
// Dwa kolka wiszace nad trescia zaslanialy ostatnie wiersze listy i konkurowaly wzrokowo
// z dolnym paskiem CTA. Teraz w spoczynku jest jedno; rozwija sie tapnieciem i skleja
// z powrotem po wyborze albo po tapnieciu w tlo.
//
// Odznaka (nieprzeczytane wiadomosci) wedruje na guzik zwiniety - inaczej po schowaniu
// czatu nie bylo zadnego sygnalu, ze ktos cos napisal.

export type TripFab = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  badge?: number;
};

const SIZE = 56;      // 14 * 4 px - ten sam rozmiar co dotychczasowe kolka
const GAP = 12;
const BASE = 84;      // px nad dolna krawedzia (ponad dolnym paskiem CTA)

export default function TripFabStack({ actions }: { actions: TripFab[] }) {
  const { t } = useTranslation("sharing");
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;

  const totalBadge = actions.reduce((n, a) => n + (a.badge ?? 0), 0);

  return (
    <>
      {/* Tlo lapiace tapniecie poza stosem - bez niego jedynym sposobem zwiniecia bylo
          trafienie w ten sam maly guzik. */}
      <AnimatePresence>
        {open && (
          <motion.button
            /* Tlo jest wygoda dla palca, nie osobna kontrolka: bez aria-hidden czytnik
               ekranu widzialby DWA guziki o tej samej nazwie ("Schowaj akcje wyjazdu").
               Dla klawiatury i czytnika zostaje sam widoczny przelacznik nizej. */
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && actions.map((a, i) => (
          <motion.button
            key={a.key}
            aria-label={a.label}
            onClick={() => { haptics.light(); setOpen(false); a.onClick(); }}
            /* Akcje w stosie sa DRUGOPLANOWE (biale kolko) - pomaranczowy zostaje dla
               guzika, ktory ten stos otwiera (prosba Nat 2026-09-10). Gdyby ktoras z nich
               byla primary, konkurowalaby z nim o uwage dokladnie w chwili, w ktorej
               user szuka wzrokiem, czym to zamknac. */
            className="fixed right-4 z-40 rounded-full flex items-center justify-center bg-background text-foreground border border-border shadow-lg shadow-black/10 active:scale-90 transition-transform"
            style={{ height: SIZE, width: SIZE, bottom: `calc(${BASE + (i + 1) * (SIZE + GAP)}px + env(safe-area-inset-bottom, 0px))` }}
            initial={{ opacity: 0, y: 12, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 420, damping: 28, delay: i * 0.04 }}
          >
            {a.icon}
            {!!a.badge && a.badge > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white leading-none">
                {a.badge > 9 ? "9+" : a.badge}
              </span>
            )}
          </motion.button>
        ))}
      </AnimatePresence>

      <button
        aria-label={open ? t("fabs.collapse") : t("fabs.expand")}
        aria-expanded={open}
        onClick={() => { haptics.light(); setOpen((v) => !v); }}
        /* Guzik otwierajacy stos jest PRIMARY (prosba Nat 2026-09-10): w spoczynku to jedyna
           plywajaca akcja na ekranie i musi byc widoczna takze na jasnym zdjeciu - biale kolko
           na bialej karcie gubilo sie. Kolor zostaje TAKZE po rozwinieciu, zeby bylo widac,
           czym stos zamknac. */
        className="fixed right-4 z-40 rounded-full bg-primary text-white shadow-lg shadow-black/15 flex items-center justify-center active:scale-90 transition-transform"
        style={{ height: SIZE, width: SIZE, bottom: `calc(${BASE}px + env(safe-area-inset-bottom, 0px))` }}
      >
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
          <ChevronUp className="h-6 w-6" strokeWidth={2.2} />
        </motion.span>
        {!open && totalBadge > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white leading-none">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>
    </>
  );
}
