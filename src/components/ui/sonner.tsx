import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Toast u GORY ekranu jako biala pigulka (prosba Nat 2026-09-11, wzor: Pinterest "Saved to
// Profile [View]"): tekst po lewej, po prawej mala CIEMNA pigulka z akcja ("Cofnij" / "Zobacz").
// Akcje juz istnieja w wywolaniach (deferDelete, zapis, publikacja) - tu dostaja tylko ksztalt.
// Pozycja: pod notchem / dynamic island (safe-area-top + 12 px). Wczesniej toast siedzial nad
// dolnym paskiem nawigacji i przy otwartym arkuszu ginal pod nim.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <>
      <style>{`
        [data-sonner-toast]{align-items:center!important}
        [data-sonner-toast] [data-content]{flex:1 1 auto;text-align:left;min-width:0}
        [data-sonner-toaster][data-y-position="top"]{top:calc(env(safe-area-inset-top, 0px) + 12px)!important}
      `}</style>
      <Sonner
        theme="light"
        className="toaster group"
        position="top-center"
        gap={8}
        offset={0}
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:w-auto group-[.toaster]:min-w-[220px] group-[.toaster]:max-w-[calc(100vw-2rem)] group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-black/[0.06] group-[.toaster]:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.22)] group-[.toaster]:rounded-full group-[.toaster]:min-h-[52px] group-[.toaster]:py-2 group-[.toaster]:pl-5 group-[.toaster]:pr-2 group-[.toaster]:gap-3 group-[.toaster]:items-center",
            title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:text-foreground group-[.toast]:leading-snug",
            description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:mt-0.5 group-[.toast]:leading-relaxed",
            // Akcja = mala ciemna pigulka (jak "View" na Pintereście).
            actionButton: "group-[.toast]:!bg-foreground group-[.toast]:!text-background group-[.toast]:!font-bold group-[.toast]:!text-[13px] group-[.toast]:!h-9 group-[.toast]:!px-4 group-[.toast]:!rounded-full group-[.toast]:!shrink-0 group-[.toast]:!ml-1",
            // Bez ikony - pigulka ma byc lekka.
            icon: "group-[.toast]:hidden",
          },
        }}
        {...props}
      />
    </>
  );
};

export { Toaster, toast };
