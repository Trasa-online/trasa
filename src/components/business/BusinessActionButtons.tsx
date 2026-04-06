import { Phone, Globe, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BusinessData } from "./mockBusinessData";
import { supabase } from "@/integrations/supabase/client";

interface BusinessActionButtonsProps {
  business: BusinessData;
  placeId?: string | null;
}

const BusinessActionButtons = ({ business, placeId }: BusinessActionButtonsProps) => {
  const trackEvent = async (type: string) => {
    if (!placeId) return;
    await (supabase as any).from("place_events").insert({
      place_id: placeId,
      event_type: type,
      user_id: null,
    });
  };

  const handleCall = async () => {
    await trackEvent("click_phone");
    window.location.href = `tel:${business.phone}`;
  };

  const handleWebsite = async () => {
    await trackEvent("click_website");
    window.open(business.website, "_blank");
  };

  const handleBooking = async () => {
    await trackEvent("click_booking");
    window.open(business.booking_url, "_blank");
  };

  return (
    <div className="grid grid-cols-3 gap-2 px-4">
      <Button
        variant="outline"
        className="flex-col h-auto py-3 gap-1"
        onClick={handleCall}
      >
        <Phone className="h-5 w-5" />
        <span className="text-xs">Zadzwoń</span>
      </Button>
      <Button
        variant="outline"
        className="flex-col h-auto py-3 gap-1"
        onClick={handleWebsite}
      >
        <Globe className="h-5 w-5" />
        <span className="text-xs">Strona</span>
      </Button>
      <Button
        variant="outline"
        className="flex-col h-auto py-3 gap-1"
        onClick={handleBooking}
      >
        <Calendar className="h-5 w-5" />
        <span className="text-xs">Rezerwuj</span>
      </Button>
    </div>
  );
};

export default BusinessActionButtons;
