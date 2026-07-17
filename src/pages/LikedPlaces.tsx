import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PullToRefresh } from "@/components/PullToRefresh";
import { LikedTab } from "./Explore";

// Dedykowany widok polubionych (przeniesiony z zakladki "polubione" w Eksploruj).
// Wejscie: ikona serca w TopBarze na /home (tylko dla zalogowanych).
const LikedPlaces = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("myplan");

  return (
    <PullToRefresh
      onRefresh={async () => { await queryClient.invalidateQueries(); }}
      className="flex-1 flex flex-col pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="px-4 mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label={t("liked.back")}
          className="h-9 w-9 -ml-1 flex items-center justify-center rounded-full text-foreground active:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight">{t("liked.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("liked.subtitle")}</p>
        </div>
      </div>

      <div className="flex-1 px-4">
        <LikedTab />
      </div>
    </PullToRefresh>
  );
};

export default LikedPlaces;
