import { useNavigate } from "react-router-dom";
import { Zap, Edit, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface CreateModeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateModeDrawer = ({ open, onOpenChange }: CreateModeDrawerProps) => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<'quick' | 'detailed' | null>(null);

  const handleContinue = () => {
    if (selectedMode === 'quick') {
      navigate("/quick-capture");
    } else {
      navigate("/create");
    }
    onOpenChange(false);
    setSelectedMode(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedMode(null);
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="text-xl">Jak chcesz tworzyć trasę?</DrawerTitle>
          <DrawerDescription>
            Wybierz tryb dodawania miejsc do trasy
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          {/* Quick Capture Mode */}
          <button
            type="button"
            onClick={() => setSelectedMode('quick')}
            className={cn(
              "w-full p-5 rounded-xl border-2 transition-all text-left",
              selectedMode === 'quick'
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                : "border-border hover:border-primary/50 hover:shadow-sm"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="text-4xl">⚡</div>
              <div className="flex-1">
                <div className="font-semibold text-base mb-1">Szybki tryb</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dodawaj miejsca w 10 sekund podczas wycieczki. Lokalizacja i zdjęcie - gotowe!
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Zap className="h-3 w-3" />
                  <span>Idealny podczas podróży</span>
                </div>
              </div>
              {selectedMode === 'quick' && (
                <Check className="h-5 w-5 text-primary flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Detailed Mode */}
          <button
            type="button"
            onClick={() => setSelectedMode('detailed')}
            className={cn(
              "w-full p-5 rounded-xl border-2 transition-all text-left",
              selectedMode === 'detailed'
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                : "border-border hover:border-primary/50 hover:shadow-sm"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="text-4xl">✍️</div>
              <div className="flex-1">
                <div className="font-semibold text-base mb-1">Szczegółowy tryb</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pełna kontrola. Dodawaj opisy, oceny, kategorie i notatki od razu.
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Edit className="h-3 w-3" />
                  <span>Idealny po podróży</span>
                </div>
              </div>
              {selectedMode === 'detailed' && (
                <Check className="h-5 w-5 text-primary flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Helpful hint */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              💡 <strong>Wskazówka:</strong> Nie martw się! Niezależnie od wybranego trybu, zawsze możesz dodać szczegóły później.
            </p>
          </div>

          {/* Continue button */}
          <Button
            onClick={handleContinue}
            disabled={!selectedMode}
            className="w-full h-12 text-base font-semibold"
          >
            Kontynuuj
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
