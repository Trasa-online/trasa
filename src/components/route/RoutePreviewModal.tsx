import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import { format } from "date-fns";
import RoutePlanTimeline from "./RoutePlanTimeline";

interface RoutePin {
  place_name: string;
  description?: string | null;
  suggested_time?: string | null;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
}

interface RouteDay {
  day_number: number;
  title: string;
  start_date: string | null;
  pins: RoutePin[];
}

interface RoutePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: RouteDay[];
  city: string;
  startDate: string | null;
  endDate: string | null;
}

const RoutePreviewModal = ({
  open,
  onOpenChange,
  days,
  city,
  startDate,
  endDate,
}: RoutePreviewModalProps) => {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const dateTitle = start
    ? end && end.getTime() !== start.getTime()
      ? `Twoja trasa ${format(start, "dd")}-${format(end, "dd.MM.yyyy")}`
      : `Twoja trasa ${format(start, "dd.MM.yyyy")}`
    : `Twoja trasa — ${city}`;

  const timelineDays = days.map(d => ({
    day_number: d.day_number,
    pins: d.pins.map(p => ({
      place_name: p.place_name,
      description: p.description || "",
      suggested_time: p.suggested_time || "",
    })),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 gap-0 [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>{dateTitle}</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-start justify-between p-5 pb-0">
          <h2 className="text-xl font-bold leading-tight pr-4">{dateTitle}</h2>
          <button onClick={() => onOpenChange(false)} className="shrink-0 mt-0.5">
            <X className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>

        <div className="h-px bg-border mx-5 mt-3" />

        <div className="mx-5 mt-4 rounded-xl overflow-hidden bg-muted aspect-[16/9] flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Mapa</span>
        </div>

        <RoutePlanTimeline days={timelineDays} totalDays={days.length} />
      </DialogContent>
    </Dialog>
  );
};

export default RoutePreviewModal;
