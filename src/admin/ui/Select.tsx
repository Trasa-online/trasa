// Filtr rozwijany. Natywny <select> celowo: na telefonie dostajemy systemowe kolo
// wyboru zamiast wlasnej listy, ktora trzeba by obslugiwac klawiatura od zera.
import { ChevronDown } from "lucide-react";

export function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] pl-3 pr-8 text-[13px] text-[var(--graphite)] shadow-[var(--shadow-inset)] outline-none focus:border-[var(--accent)]"
      >
        <option value="">{label}: wszystkie</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--stone)]" />
    </div>
  );
}
