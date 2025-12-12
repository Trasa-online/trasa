import { useState, useEffect } from "react";
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
import { Camera, X, Upload, MapPin, Star, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!existingVisit;

  // Sync state when dialog opens or existingVisit changes
  useEffect(() => {
    if (open) {
      setDescription(existingVisit?.description || "");
      setRating(existingVisit?.rating || 0);
      setImageUrl(existingVisit?.image_url || "");
    }
  }, [open, existingVisit]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pin_visits")
        .delete()
        .eq("pin_id", pinId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pin-visitors", pinId] });
      queryClient.invalidateQueries({ queryKey: ["pin-visits-details", pinId] });
      queryClient.invalidateQueries({ queryKey: ["route-pin-visitors"] });
      toast({ title: "Usunięto ocenę" });
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Wystąpił błąd", variant: "destructive" });
    },
  });

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
      // Use upsert to handle both new visits and updates
      const { error } = await supabase
        .from("pin_visits")
        .upsert({
          pin_id: pinId,
          user_id: userId,
          image_url: imageUrl || null,
          description: description || null,
          rating: rating || null,
        }, { onConflict: 'pin_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pin-visitors", pinId] });
      queryClient.invalidateQueries({ queryKey: ["pin-visits-details", pinId] });
      queryClient.invalidateQueries({ queryKey: ["route-pin-visitors"] });
      toast({ title: isEditing ? "Zaktualizowano opinię" : "Dodano opinię!" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Wystąpił błąd", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            {isEditing ? "Edytuj swoją opinię" : "Dodaj coś od siebie"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{pinName}</p>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Twoja ocena *</Label>
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
                        ? "fill-foreground text-foreground"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Twój komentarz *</Label>
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

          {/* Image upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Zdjęcie z miejsca (opcjonalne)</Label>
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
                  className="absolute top-2 right-2 p-1.5 bg-background/90 backdrop-blur rounded-full hover:bg-background transition-colors border border-border"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-10 w-10 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Przesyłanie...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="p-3 rounded-full bg-foreground/10">
                      <Camera className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">Dodaj zdjęcie</span>
                    <span className="text-xs">Kliknij lub przeciągnij</span>
                  </div>
                )}
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {isEditing && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-border"
            >
              Anuluj
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || rating === 0 || !description.trim()}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              {saveMutation.isPending ? "Zapisywanie..." : isEditing ? "Zapisz zmiany" : "Dodaj"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń ocenę</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć swoją ocenę? Ta akcja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
