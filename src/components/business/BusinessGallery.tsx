import { Camera } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { BusinessData } from "./mockBusinessData";

interface BusinessGalleryProps {
  business: BusinessData;
  onImageClick: (images: string[], index: number) => void;
}

const BusinessGallery = ({ business, onImageClick }: BusinessGalleryProps) => {
  if (!business.images || business.images.length === 0) return null;

  const allImageUrls = business.images.map(img => img.url);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2 px-4">
        <Camera className="h-4 w-4" />
        Galeria ({business.images.length})
      </h3>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 pl-4">
          {business.images.map((image, index) => (
            <CarouselItem key={index} className="pl-2 basis-2/3 md:basis-1/2">
              <div 
                className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => onImageClick(allImageUrls, index)}
              >
                <img
                  src={image.url}
                  alt={image.caption}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                {image.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-xs">{image.caption}</p>
                  </div>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
    </div>
  );
};

export default BusinessGallery;
