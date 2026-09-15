// Pole tekstowe panelu. Jedna wysokosc, jeden obrys, jeden focus - zeby formularze
// w kolejce i w ustawieniach nie wygladaly jak z dwoch roznych narzedzi.
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const BASE =
  "w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)] focus:border-[var(--accent)]";

export function TextField({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(BASE, "h-9", className)} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(BASE, "resize-none py-2 leading-5", className)} />;
}
