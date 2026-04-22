import { Phone, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

interface BusinessActionButtonsProps {
  phone?: string | null;
  website?: string | null;
  placeId?: string | null;
  userId?: string | null;
}

const BusinessActionButtons = ({ phone, website, placeId }: BusinessActionButtonsProps) => {
  const trackEvent = (type: "place_phone_clicked" | "place_website_clicked") => {
    if (!placeId) return;
    posthog.capture(type, { place_id: placeId });
  };

  if (!phone && !website) return null;

  return (
    <div className={`grid gap-2 ${phone && website ? "grid-cols-2" : "grid-cols-1"}`}>
      {phone && (
        <Button
          variant="outline"
          className="flex-col h-auto py-3 gap-1"
          onClick={() => {
            trackEvent("place_phone_clicked");
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
            trackEvent("place_website_clicked");
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
