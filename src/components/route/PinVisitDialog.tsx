import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, X, Upload, MapPin, Star } from "lucide-react";
import { Label } from "@/components/ui/label";

interface PinVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinId: string;
  pinName: string;
  userId: string;
  existingVisit?: {
    image_url?: string;
    description?: string;
    rating?: number;
  } | null;
}

export const PinVisitDialog = ({
  open,
  onOpenChange,
  pinId,
  pinName,
  userId,
  existingVisit,
}: PinVisitDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(existingVisit?.description || "");
  const [rating, setRating] = useState(existingVisit?.rating || 0);
  const [imageUrl, setImageUrl] = useState(existingVisit?.image_url || "");
  const [uploading, setUploading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  const isEditing = !!existingVisit;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Plik jest za duży (max 5MB)", variant: "destructive" });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${pinId}-${Date.now()}.${fileExt}`;
    const filePath = `pin-visits/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("route-images")
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: "Błąd podczas przesyłania zdjęcia", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("route-images").getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const removeImage = async () => {
    if (imageUrl) {
      const path = imageUrl.split("/route-images/")[1];
      if (path) {
        await supabase.storage.from("route-images").remove([path]);
      }
    }
    setImageUrl("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        const { error } = await supabase
          .from("pin_visits")
          .update({
            image_url: imageUrl || null,
            description: description || null,
            rating: rating || null,
          })
          .eq("pin_id", pinId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pin_visits").insert({
          pin_id: pinId,
          user_id: userId,
          image_url: imageUrl || null,
          description: description || null,
          rating: rating || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pin-visitors", pinId] });
      queryClient.invalidateQueries({ queryKey: ["route-pin-visitors"] });
      toast({ title: isEditing ? "Zaktualizowano odwiedziny" : "Dodano odwiedziny!" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Wystąpił błąd", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            {isEditing ? "Edytuj odwiedziny" : "Byłem tu!"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{pinName}</p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Image upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Zdjęcie z miejsca</Label>
            {imageUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                <img
                  src={imageUrl}
                  alt="Zdjęcie odwiedzin"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1.5 bg-background/90 backdrop-blur rounded-full hover:bg-background transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Przesyłanie...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium">Dodaj zdjęcie</span>
                    <span className="text-xs">Kliknij lub przeciągnij</span>
                  </div>
                )}
              </label>
            )}
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Twoja ocena</Label>
            <div className="flex items-center justify-center gap-1 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Twój komentarz</Label>
            <Textarea
              placeholder="Opisz swoje wrażenia z tego miejsca..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Anuluj
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? (
                "Zapisywanie..."
              ) : isEditing ? (
                "Zapisz zmiany"
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Potwierdź wizytę
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
