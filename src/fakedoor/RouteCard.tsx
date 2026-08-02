import { useState } from "react";
import { MapPin, Clock } from "lucide-react";
import { nbsp } from "./text";
import { routeCover, type MockRoute } from "./mockRoutes";

export default function RouteCard({ route, onClick }: { route: MockRoute; onClick: () => void }) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-3xl overflow-hidden bg-white border border-black/[0.06] shadow-sm hover:shadow-md transition active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: "#fcede3" }}>
        {imgOk && (
          <img
            src={routeCover(route.id)}
            alt={route.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-xs font-semibold text-[#0E0E0E]">
          {route.city}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-extrabold text-[#0E0E0E] leading-snug line-clamp-2">{nbsp(route.title)}</h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-[#979797]">
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> {route.duration}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} /> {route.places.length} miejsc
          </span>
          <span className="ml-auto text-[#CFCFCF]">by {route.author}</span>
        </div>
      </div>
    </button>
  );
}
