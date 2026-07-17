import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";

export type DayHours = { open: string; close: string } | { closed: true };
export type OpeningHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>>;

const DAY_KEYS: (keyof OpeningHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface BusinessHoursEditorProps {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
}

const isClosed = (d?: DayHours): d is { closed: true } => !!d && "closed" in d;
const getOpen = (d?: DayHours): string => (d && !isClosed(d) ? d.open : "09:00");
const getClose = (d?: DayHours): string => (d && !isClosed(d) ? d.close : "22:00");

const BusinessHoursEditor = ({ value, onChange }: BusinessHoursEditorProps) => {
  const { t } = useTranslation("bizonboard");
  const setDay = (key: keyof OpeningHours, next: DayHours | undefined) => {
    const draft = { ...value };
    if (next === undefined) delete draft[key];
    else draft[key] = next;
    onChange(draft);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Label className="text-xs flex items-center gap-1.5 flex-wrap">
          {t("hours.title")}
          <span className="text-[10px] font-normal text-muted-foreground">{t("hours.optional")}</span>
        </Label>
      </div>
      <div className="space-y-2">
        {DAY_KEYS.map((key) => {
          const day = value[key];
          const closed = isClosed(day);
          const unset = !day;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">{t(`days.${key}`)}</span>
              {unset ? (
                <button
                  type="button"
                  onClick={() => setDay(key, { open: "09:00", close: "22:00" })}
                  className="flex-1 text-xs text-muted-foreground/70 px-3 py-2 rounded-xl border border-dashed border-slate-200 hover:border-slate-300 hover:text-muted-foreground text-left transition-colors"
                >
                  {t("hours.set_hours")}
                </button>
              ) : closed ? (
                <div className="flex-1 flex items-center gap-2">
                  <span className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-muted-foreground">{t("hours.closed")}</span>
                  <button
                    type="button"
                    onClick={() => setDay(key, { open: "09:00", close: "22:00" })}
                    className="text-xs text-orange-600 font-medium px-2"
                  >
                    {t("hours.open_action")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDay(key, undefined)}
                    className="text-xs text-muted-foreground px-2"
                    aria-label={t("hours.clear")}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    type="time"
                    value={getOpen(day)}
                    onChange={(e) => setDay(key, { open: e.target.value, close: getClose(day) })}
                    className="flex-1 text-xs px-2 py-2 rounded-xl border border-slate-200 bg-white"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <input
                    type="time"
                    value={getClose(day)}
                    onChange={(e) => setDay(key, { open: getOpen(day), close: e.target.value })}
                    className="flex-1 text-xs px-2 py-2 rounded-xl border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setDay(key, { closed: true })}
                    className="text-[11px] text-muted-foreground px-2"
                    title={t("hours.mark_closed")}
                  >
                    {t("hours.close_action")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDay(key, undefined)}
                    className="text-xs text-muted-foreground px-1.5"
                    aria-label={t("hours.clear")}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BusinessHoursEditor;
