import { useNavigate } from "react-router-dom";

const SwipeHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 pt-safe-4 max-w-lg mx-auto w-full">
        <h1 className="text-xl font-black tracking-tight pt-3 pb-3">Polubione miejsca</h1>
      </div>

      <div className="flex-1 px-4 pb-28 max-w-lg mx-auto w-full">
        <div className="h-full min-h-[520px] rounded-3xl bg-card border border-border/40 flex flex-col items-center justify-center gap-5 px-8 text-center">
          {/* Illustration */}
          <svg width="110" height="110" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Planet body */}
            <circle cx="55" cy="52" r="34" fill="url(#planetGrad)" />
            {/* Ring */}
            <ellipse cx="55" cy="58" rx="46" ry="11" stroke="url(#ringGrad)" strokeWidth="5" fill="none" />
            {/* Sleepy eyes */}
            <path d="M43 50 Q46 46 49 50" stroke="#5a3e7a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M61 50 Q64 46 67 50" stroke="#5a3e7a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            {/* Zzz */}
            <text x="72" y="28" fontSize="11" fill="#a78bfa" fontWeight="bold" opacity="0.8">z</text>
            <text x="79" y="20" fontSize="9" fill="#a78bfa" fontWeight="bold" opacity="0.6">z</text>
            <defs>
              <radialGradient id="planetGrad" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#e0f7f0" />
                <stop offset="60%" stopColor="#c4f0e0" />
                <stop offset="100%" stopColor="#a5d8cc" />
              </radialGradient>
              <linearGradient id="ringGrad" x1="9" y1="58" x2="101" y2="58" gradientUnits="userSpaceOnUse">
                <stop stopColor="#c084fc" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>

          <div className="space-y-2">
            <p className="text-xl font-bold tracking-tight">Wkrótce tutaj</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
              Historia polubionych miejsc pojawi się tutaj, gdy skorzystasz ze swipera.
            </p>
          </div>

          <button
            onClick={() => navigate("/plan")}
            className="mt-1 px-8 py-3 rounded-full bg-orange-600 hover:bg-orange-700 active:scale-[0.97] text-white font-semibold text-sm transition-all"
          >
            Zaplanuj trasę
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwipeHistory;
