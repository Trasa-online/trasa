import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Toast w stylu Gmail/Material snackbar: banalny, uzyteczny pasek na dole - jasnoszare
// tlo, sam tekst do lewej, BEZ ikony, BEZ przycisku zamkniecia, auto-znika. Pozycja
// pionowa liczona z --trasa-nav-offset (ustawianego przez BottomNav): tuz nad paskiem
// nawigacji gdy widoczny, przy samym dole gdy ukryty (np. widok przegladania).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <>
      <style>{`
        [data-sonner-toast]{align-items:center!important}
        [data-sonner-toast] [data-content]{flex:1 1 auto;text-align:left}
        /* Toasty na gorze (np. nad otwartym bottom-sheetem) - ponizej notch/dynamic island */
        [data-sonner-toaster][data-y-position="top"]{top:calc(env(safe-area-inset-top, 0px) + 12px)!important}
      `}</style>
      <Sonner
        theme="light"
        className="toaster group"
        position="bottom-center"
        gap={8}
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:w-[calc(100vw-2rem)] group-[.toaster]:max-w-md group-[.toaster]:bg-[#f6f6f7] group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-black/[0.06] group-[.toaster]:shadow-lg group-[.toaster]:shadow-black/[0.08] group-[.toaster]:rounded-2xl group-[.toaster]:py-3 group-[.toaster]:px-4 group-[.toaster]:gap-2 group-[.toaster]:items-center group-[.toaster]:mb-[calc(var(--trasa-nav-offset,0px)+env(safe-area-inset-bottom,0px)+10px)]",
            title: "group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:text-foreground group-[.toast]:leading-snug",
            description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:mt-0.5 group-[.toast]:leading-relaxed",
            // Akcja (np. "Cofnij") - pomaranczowy link po prawej, bez tla.
            actionButton: "group-[.toast]:!bg-transparent group-[.toast]:!text-primary group-[.toast]:!font-bold group-[.toast]:!text-sm group-[.toast]:!px-1 group-[.toast]:!shrink-0",
            // Bez ikony (Gmail-plain).
            icon: "group-[.toast]:hidden",
          },
        }}
        {...props}
      />
    </>
  );
};

export { Toaster, toast };
