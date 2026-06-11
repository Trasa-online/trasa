import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Jednolity wyglad WSZYSTKICH toastow (kategorie kolorystyczne + ikona w bialym
// kole + przycisk zamkniecia). Konfiguracja globalna, wiec kazde toast.success/
// error/warning/info (i notify.*) w calej apce dostaje ten sam styl bez edycji
// setek wywolan.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-center"
      closeButton
      gap={8}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-green-600" strokeWidth={2.4} />,
        error: <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={2.4} />,
        warning: <AlertCircle className="h-5 w-5 text-amber-500" strokeWidth={2.4} />,
        info: <Info className="h-5 w-5 text-blue-600" strokeWidth={2.4} />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[calc(100vw-2rem)] group-[.toaster]:max-w-md group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/50 group-[.toaster]:shadow-lg group-[.toaster]:shadow-black/5 group-[.toaster]:rounded-2xl group-[.toaster]:p-3.5 group-[.toaster]:gap-3 group-[.toaster]:items-start group-[.toaster]:mb-[calc(4rem+env(safe-area-inset-bottom,0px))]",
          title: "group-[.toast]:text-sm group-[.toast]:font-bold group-[.toast]:text-foreground group-[.toast]:leading-snug",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:mt-0.5 group-[.toast]:leading-relaxed",
          icon: "group-[.toast]:h-11 group-[.toast]:w-11 group-[.toast]:m-0 group-[.toast]:mr-1 group-[.toast]:rounded-full group-[.toast]:bg-white group-[.toast]:shadow-sm group-[.toast]:shrink-0 group-[.toast]:flex group-[.toast]:items-center group-[.toast]:justify-center group-[.toast]:self-start",
          closeButton:
            "group-[.toast]:!left-auto group-[.toast]:!right-2 group-[.toast]:!top-1/2 group-[.toast]:!-translate-y-1/2 group-[.toast]:!bg-transparent group-[.toast]:!border-0 group-[.toast]:!text-muted-foreground/60",
          success: "group-[.toaster]:bg-green-50 group-[.toaster]:border-green-100",
          error: "group-[.toaster]:bg-red-50 group-[.toaster]:border-red-100",
          warning: "group-[.toaster]:bg-amber-50 group-[.toaster]:border-amber-100",
          info: "group-[.toaster]:bg-blue-50 group-[.toaster]:border-blue-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
