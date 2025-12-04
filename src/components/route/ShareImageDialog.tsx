import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ImageIcon, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShareImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: {
    id: string;
    title: string;
    description?: string;
    pins?: any[];
  };
}

export const ShareImageDialog = ({ open, onOpenChange, route }: ShareImageDialogProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-route-image", {
        body: {
          title: route.title,
          description: route.description,
          pins: route.pins?.slice(0, 5).map((p: any) => ({
            place_name: p.place_name,
            address: p.address,
          })),
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Obrazek wygenerowany!");
      }
    } catch (err: any) {
      console.error("Error generating image:", err);
      toast.error(err.message || "Nie udało się wygenerować obrazka");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `trasa-${route.title.replace(/\s+/g, "-").toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Obrazek pobrany!");
  };

  const handleShare = async () => {
    if (!generatedImage) return;

    try {
      // Convert base64 to blob
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const file = new File([blob], `trasa-${route.title}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: route.title,
          text: route.description || `Sprawdź trasę: ${route.title}`,
          files: [file],
        });
      } else {
        // Fallback: copy image URL or download
        handleDownload();
      }
    } catch (err) {
      console.error("Share error:", err);
      handleDownload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Generuj obrazek do social media
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!generatedImage ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              {isGenerating ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Generowanie obrazka...</p>
                  <p className="text-xs text-muted-foreground">To może potrwać do 30 sekund</p>
                </>
              ) : (
                <>
                  <div className="w-full h-40 bg-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                    <div className="text-center">
                      <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Wygeneruj obrazek trasy do udostępnienia
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleGenerate} className="w-full">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Generuj obrazek
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-border">
                <img
                  src={generatedImage}
                  alt={`Obrazek trasy: ${route.title}`}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownload} variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Pobierz
                </Button>
                <Button onClick={handleShare} className="flex-1">
                  <Share2 className="h-4 w-4 mr-2" />
                  Udostępnij
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setGeneratedImage(null);
                }}
              >
                Wygeneruj ponownie
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
