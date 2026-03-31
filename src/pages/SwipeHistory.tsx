import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SwipeHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 pt-safe-4 max-w-lg mx-auto w-full">
        <h1 className="text-xl font-black tracking-tight pt-3 pb-5">Polubione miejsca</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4 pb-24">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
          <Heart className="h-7 w-7 text-rose-500" />
        </div>
        <div>
          <p className="text-base font-bold mb-1">Wkrótce tutaj</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
            Historia polubionych i odrzuconych miejsc ze swipera pojawi się w tej sekcji.
          </p>
        </div>
        <button
          onClick={() => navigate("/plan")}
          className="mt-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-colors"
        >
          Dodaj nową trasę
        </button>
      </div>
    </div>
  );
};

export default SwipeHistory;
