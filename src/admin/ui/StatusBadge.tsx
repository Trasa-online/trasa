// Plakietka statusu. Kolor niesie semantyke, NIE marke - pomarancz jest zarezerwowany
// dla akcji (guzik primary, aktywna nawigacja, aktywny chip, focus ring).
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "ok" | "warn" | "bad";

const TONE: Record<Tone, string> = {
  neutral: "bg-[var(--canvas)] text-[var(--graphite)] border border-[var(--line)]",
  ok: "bg-[var(--ok-bg)] text-[var(--ok)]",
  warn: "bg-[var(--warn-bg)] text-[var(--warn)]",
  bad: "bg-[var(--bad-bg)] text-[var(--bad)]",
};

export function StatusBadge({ children, tone = "neutral", mono = false, className }: {
  children: React.ReactNode; tone?: Tone; mono?: boolean; className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-[var(--r-control)] px-2 py-[3px] text-[11px] leading-[15px] font-medium whitespace-nowrap",
      TONE[tone], mono && "data", className,
    )}>
      {children}
    </span>
  );
}
