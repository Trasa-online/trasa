import { Copy, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { BusinessData } from "./mockBusinessData";

interface BusinessPromoCardProps {
  business: BusinessData;
}

const BusinessPromoCard = ({ business }: BusinessPromoCardProps) => {
  if (!business.promo_title) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(business.promo_code);
    toast.success("Kod skopiowany!");
  };

  const expiresDate = new Date(business.promo_expires_at);
  const isExpired = expiresDate < new Date();

  if (isExpired) return null;

  return (
    <div className="mx-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/5 border border-amber-500/20">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 rounded-full">
          <PartyPopper className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="font-semibold text-sm">PROMOCJA</p>
            <p className="font-bold text-base">{business.promo_title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{business.promo_description}</p>
          
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Kod:</span>
              <code className="px-2 py-1 bg-background rounded border text-sm font-mono font-semibold">
                {business.promo_code}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopyCode}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              Ważne do: {format(expiresDate, "d MMM yyyy", { locale: pl })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessPromoCard;
