import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ImageIcon, Share2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface ShareImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: {
    id: string;
    title: string;
    description?: string;
    pins?: any[];
    profiles?: {
      username?: string;
    };
  };
}

export const ShareImageDialog = ({ open, onOpenChange, route }: ShareImageDialogProps) => {
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Instagram/Facebook optimal size (1080x1080 for Instagram square)
    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    // Background - clean white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Border frame
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Inner decorative line
    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 1;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    // Top section - TRASA branding
    ctx.fillStyle = "#000000";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TRASA", width / 2, 120);

    // Decorative line under branding
    ctx.beginPath();
    ctx.moveTo(width / 2 - 60, 140);
    ctx.lineTo(width / 2 + 60, 140);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Main title
    ctx.fillStyle = "#000000";
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.textAlign = "center";
    
    // Word wrap for title
    const maxWidth = width - 160;
    const words = route.title.split(" ");
    let lines: string[] = [];
    let currentLine = "";
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Center the title block vertically
    const lineHeight = 70;
    const titleBlockHeight = lines.length * lineHeight;
    let titleY = (height / 2) - (titleBlockHeight / 2) + 40;

    for (const line of lines) {
      ctx.fillText(line, width / 2, titleY);
      titleY += lineHeight;
    }

    // Pin count circle
    const pinCount = route.pins?.filter((p: any) => !p.is_transport).length || 0;
    const circleY = titleY + 60;
    
    ctx.beginPath();
    ctx.arc(width / 2, circleY, 50, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText(pinCount.toString(), width / 2, circleY + 14);

    // "miejsc" label
    ctx.fillStyle = "#666666";
    ctx.font = "400 24px system-ui, sans-serif";
    const placesLabel = pinCount === 1 ? "miejsce" : pinCount < 5 ? "miejsca" : "miejsc";
    ctx.fillText(placesLabel, width / 2, circleY + 90);

    // Pin locations preview (up to 4)
    const sortedPins = route.pins
      ?.filter((p: any) => !p.is_transport)
      .sort((a: any, b: any) => a.pin_order - b.pin_order)
      .slice(0, 4) || [];

    if (sortedPins.length > 0) {
      ctx.fillStyle = "#999999";
      ctx.font = "400 22px system-ui, sans-serif";
      const pinsText = sortedPins
        .map((p: any, i: number) => `${i + 1}. ${p.place_name || p.address}`)
        .join("  •  ");
      
      // Truncate if too long
      const truncatedText = pinsText.length > 80 ? pinsText.substring(0, 77) + "..." : pinsText;
      ctx.fillText(truncatedText, width / 2, height - 180);
    }

    // Bottom - MapPin icon representation and author
    ctx.fillStyle = "#000000";
    ctx.font = "400 20px system-ui, sans-serif";
    
    // Draw simple pin icon
    const iconX = width / 2 - 80;
    const iconY = height - 100;
    ctx.beginPath();
    ctx.arc(iconX, iconY - 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(iconX, iconY - 2);
    ctx.lineTo(iconX - 4, iconY + 6);
    ctx.lineTo(iconX + 4, iconY + 6);
    ctx.closePath();
    ctx.fill();

    // Author text
    if (route.profiles?.username) {
      ctx.fillStyle = "#666666";
      ctx.fillText(`@${route.profiles.username}`, width / 2 + 20, iconY);
    }

    // Convert to image
    const dataUrl = canvas.toDataURL("image/png");
    setGeneratedImage(dataUrl);
  };

  useEffect(() => {
    if (open) {
      // Small delay to ensure canvas is ready
      setTimeout(generateImage, 100);
    }
  }, [open, route]);

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

    const routeUrl = `${window.location.origin}/route/${route.id}`;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const file = new File([blob], `trasa-${route.title}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: route.title,
          text: `${route.description || `Sprawdź trasę: ${route.title}`}\n\n${routeUrl}`,
          url: routeUrl,
          files: [file],
        });
      } else {
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
            Udostępnij trasę
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hidden canvas for generation */}
          <canvas ref={canvasRef} className="hidden" />
          
          {generatedImage ? (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
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
                <Button onClick={handleShare} className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                  <Share2 className="h-4 w-4 mr-2" />
                  Udostępnij
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={generateImage}
              >
                Wygeneruj ponownie
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Generowanie...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
