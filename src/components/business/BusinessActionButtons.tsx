import { Phone, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface BusinessActionButtonsProps {
  phone?: string | null;
  website?: string | null;
  placeId?: string | null;
  userId?: string | null;
}

const BusinessActionButtons = ({ phone, website, placeId, userId }: BusinessActionButtonsProps) => {
  const trackEvent = async (type: string) => {
    if (!placeId) return;
    // Fire-and-forget — don't block the navigation
    (supabase as any).from("place_events").insert({
      place_id: placeId,
      event_type: type,
      user_id: userId ?? null,
    });
  };

  if (!phone && !website) return null;

  return (
    <div className={`grid gap-2 ${phone && website ? "grid-cols-2" : "grid-cols-1"}`}>
      {phone && (
        <Button
          variant="outline"
          className="flex-col h-auto py-3 gap-1"
          onClick={() => {
            trackEvent("click_phone");
            window.location.href = `tel:${phone}`;
          }}
        >
          <Phone className="h-5 w-5" />
          <span className="text-xs">Zadzwoń</span>
        </Button>
      )}
      {website && (
        <Button
          variant="outline"
          className="flex-col h-auto py-3 gap-1"
          onClick={() => {
            trackEvent("click_website");
            window.open(website, "_blank", "noopener,noreferrer");
          }}
        >
          <Globe className="h-5 w-5" />
          <span className="text-xs">Strona WWW</span>
        </Button>
      )}
    </div>
  );
};

export default BusinessActionButtons;
