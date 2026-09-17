import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      // Potwierdzenie jako PLYWAJACY arkusz dolny (prosba Nat 2026-09-13, "na wzor arkusza"):
      // 8 px od krawedzi, promien 40 px, duzy padding, wjazd od dolu - ten sam ksztalt, co
      // SheetContent side="bottom" (CLAUDE.md, arkusze plywajace). Wczesniej: karta na srodku
      // ekranu na cala szerokosc, z ciasnym p-6.
      className={cn(
        // ⛔ CENTRUJEMY PRZEZ `inset-x-2 mx-auto`, NIE przez `left-1/2 -translate-x-1/2`
        // (zgloszenie Nat 2026-09-17: "arkusz wyjezdza z prawej strony zamiast z dolu").
        // `tailwindcss-animate` ustawia na czas animacji `transform: translate3d(var(
        // --tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0)` - czyli NADPISUJE
        // wlasny `-translate-x-1/2` elementu. Panel przez cale wejscie siedzial wiec o polowe
        // swojej szerokosci za daleko w prawo i dopiero na koniec wskakiwal na srodek, co
        // czyta sie jako wjazd z boku. Bez transformu na elemencie animacja rusza wylacznie
        // os Y. Tak samo rozwiazany jest `SheetContent side="bottom"`.
        "fixed inset-x-2 bottom-2 z-50 mx-auto grid max-w-lg gap-3 rounded-[40px] bg-background px-6 pt-8 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-6 data-[state=open]:slide-in-from-bottom-6",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 px-1 text-center", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // Akcja (np. "Usun") NAD "Anuluj", oba na cala szerokosc - jak w arkuszach.
  <div className={cn("mt-3 flex flex-col-reverse gap-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-xl font-black leading-tight", className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("text-[15px] leading-relaxed text-muted-foreground", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), "h-12 w-full rounded-full text-base font-bold", className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    // Secondary = szary fill (CLAUDE.md), nie bialy z obwodka.
    className={cn(buttonVariants({ variant: "secondary" }), "h-12 w-full rounded-full text-base font-bold", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
