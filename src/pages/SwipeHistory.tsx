import { useNavigate } from "react-router-dom";

const SwipeHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col px-4 pt-2 pb-4">
      <h1 className="text-xl font-black tracking-tight pt-2 pb-3">Polubione miejsca</h1>

      <div className="flex-1 rounded-3xl bg-card border border-border/40 flex flex-col items-center justify-center gap-5 px-8 text-center">
        {/* Orb — same gradient as TRASA logo */}
        <div className="w-20 h-20 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />

        <div className="space-y-2">
          <p className="text-xl font-bold tracking-tight">Wkrótce tutaj</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
            Historia polubionych miejsc pojawi się tutaj, gdy skorzystasz ze swipera.
          </p>
        </div>

        <button
          onClick={() => navigate("/plan")}
          className="px-8 py-3 rounded-full bg-orange-600 hover:bg-orange-700 active:scale-[0.97] text-white font-semibold text-sm transition-all"
        >
          Zaplanuj trasę
        </button>
      </div>
    </div>
  );
};

export default SwipeHistory;
