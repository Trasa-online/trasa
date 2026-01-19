import { Phone, Globe, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BusinessData } from "./mockBusinessData";

interface BusinessActionButtonsProps {
  business: BusinessData;
}

const BusinessActionButtons = ({ business }: BusinessActionButtonsProps) => {
  const handleCall = () => {
    window.location.href = `tel:${business.phone}`;
  };

  const handleWebsite = () => {
    window.open(business.website, "_blank");
  };

  const handleBooking = () => {
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
