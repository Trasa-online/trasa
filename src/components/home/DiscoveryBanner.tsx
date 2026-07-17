import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowRight, Construction } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function DiscoveryBanner() {
  const { t } = useTranslation("homefeed");
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="w-full text-left rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors mb-6"
      >
        <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-background" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{t("banner.title")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("banner.subtitle")}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="text-center items-center gap-3 pt-2">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Construction className="h-7 w-7 text-muted-foreground" />
            </div>
            <DialogTitle className="text-lg">{t("banner.soon_title")}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {t("banner.soon_desc")}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
