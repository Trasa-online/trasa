import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MoreVertical, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LikedTab } from "./Explore";

// Dedykowany widok polubionych (przeniesiony z zakladki "polubione" w Eksploruj).
// Wejscie: ikona serca w TopBarze na /home (tylko dla zalogowanych).
const LikedPlaces = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("myplan");
  const { t: tE } = useTranslation("explore");
  // Tryb zaznaczania miejsc do trasy (wlaczany z menu trzech kropek).
  const [selectMode, setSelectMode] = useState(false);

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
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black tracking-tight">{t("liked.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("liked.subtitle")}</p>
        </div>
        {selectMode ? (
          <button
            onClick={() => setSelectMode(false)}
            className="shrink-0 px-3 h-9 flex items-center rounded-full text-sm font-semibold text-primary active:bg-muted transition-colors"
          >
            {tE("liked.cancel_select")}
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={tE("liked.select_places")}
                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-foreground active:bg-muted transition-colors"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onClick={() => setSelectMode(true)} className="gap-2 rounded-xl cursor-pointer">
                <ListChecks className="h-4 w-4" />
                {tE("liked.select_places")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex-1 px-4">
        <LikedTab selectMode={selectMode} onExitSelection={() => setSelectMode(false)} />
      </div>
    </PullToRefresh>
  );
};

export default LikedPlaces;
