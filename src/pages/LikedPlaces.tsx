import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PullToRefresh } from "@/components/PullToRefresh";
import TabHeader from "@/components/layout/TabHeader";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LikedTab } from "./Explore";

// Dedykowany widok polubionych (zakladka Zapisane w bottom navie).
const LikedPlaces = () => {
  const queryClient = useQueryClient();
  const { t: tE } = useTranslation("explore");
  // Tryb zaznaczania miejsc do trasy (wlaczany z menu trzech kropek).
  const [selectMode, setSelectMode] = useState(false);

  return (
    <PullToRefresh
      onRefresh={async () => { await queryClient.invalidateQueries(); }}
      className="flex-1 flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
    >
      <TabHeader
        title="Zapisane"
        right={selectMode ? (
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
      />

      <div className="flex-1 px-4 pt-3">
        <LikedTab selectMode={selectMode} onExitSelection={() => setSelectMode(false)} />
      </div>
    </PullToRefresh>
  );
};

export default LikedPlaces;
