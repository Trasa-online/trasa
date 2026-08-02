import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type Option = { value: string; label: string };

// Pill-dropdown w stylu ExploreTopBar apki (kraj / miasto). Samowystarczalny,
// bez shadcn (fake door renderuje sie bez providerow). Zamyka sie klikiem obok.
export default function Selector({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[#0E0E0E] shadow-sm transition active:scale-95"
      >
        <span className="truncate">{current.label}</span>
        <ChevronDown size={16} className={`ml-auto shrink-0 text-[#979797] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-72 min-w-[190px] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white py-1 shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-black/[0.03] ${
                o.value === value ? "font-bold text-[#0E0E0E]" : "text-[#5a5a5a]"
              }`}
            >
              {o.label}
              {o.value === value && <Check size={16} className="shrink-0 text-[#F9662B]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
