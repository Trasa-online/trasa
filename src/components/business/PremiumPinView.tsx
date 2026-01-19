import { ArrowLeft, MapPin } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";

import { BusinessData } from "./mockBusinessData";
import PremiumPinHeader from "./PremiumPinHeader";
import BusinessActionButtons from "./BusinessActionButtons";
import BusinessPromoCard from "./BusinessPromoCard";
import BusinessHours from "./BusinessHours";
import BusinessGallery from "./BusinessGallery";
import BusinessSocialLinks from "./BusinessSocialLinks";
import RouteMap from "@/components/RouteMap";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Separator } from "@/components/ui/separator";

interface PinData {
  id: string;
  address: string;
  place_name?: string;
  latitude?: number;
  longitude?: number;
  pin_order: number;
  routes: {
    id: string;
    title: string;
  };
}

interface PremiumPinViewProps {
  pin: PinData;
  business: BusinessData;
}

const PremiumPinView = ({ pin, business }: PremiumPinViewProps) => {
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(`/route/${pin.routes.id}`)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <Link
              to={`/route/${pin.routes.id}`}
              className="text-xs text-muted-foreground hover:text-primary truncate block"
            >
              Z trasy: {pin.routes.title}
            </Link>
          </div>
        </div>
      </div>

      {/* Premium Header with Cover, Logo, and Info */}
      <PremiumPinHeader business={business} address={pin.address} />

      <div className="space-y-6 py-4">
        {/* Action Buttons */}
        <BusinessActionButtons business={business} />

        <Separator />

        {/* Promo Card */}
        <BusinessPromoCard business={business} />

        {/* Business Hours */}
        <BusinessHours business={business} />

        <Separator className="mx-4" />

        {/* Gallery */}
        <BusinessGallery business={business} onImageClick={openLightbox} />

        <Separator className="mx-4" />

        {/* Map */}
        {pin.latitude && pin.longitude && (
          <div className="px-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Lokalizacja
            </h3>
            <RouteMap
              pins={[{
                latitude: pin.latitude,
                longitude: pin.longitude,
                place_name: business.business_name,
                pin_order: pin.pin_order
              }]}
              className="h-40"
            />
          </div>
        )}

        <Separator className="mx-4" />

        {/* Social Links */}
        <BusinessSocialLinks business={business} />
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
};

export default PremiumPinView;
