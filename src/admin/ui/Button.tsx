// Guzik panelu. Pomarancz (`primary`) wolno uzyc TYLKO na jednej akcji w widoku -
// to jedno z czterech miejsc, gdzie kierunek "Karta danych" dopuszcza kolor marki.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90",
  ghost: "border border-[var(--line)] bg-[var(--surface)] text-[var(--graphite)] shadow-[var(--shadow-inset)] hover:bg-[var(--canvas)]",
  danger: "bg-[var(--bad)] text-white hover:opacity-90",
};

export function Button({ variant = "ghost", icon, children, className, ...rest }: {
  variant?: Variant;
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--r-control)] px-3 text-[13px] font-semibold transition-colors disabled:opacity-60",
        VARIANT[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
