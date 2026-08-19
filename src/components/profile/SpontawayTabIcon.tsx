// Ikona zakladki "wyjazdy" = znak spontaway (maska -> kontrola koloru active/inactive).
// Wspoldzielona przez wlasny profil (TravelerProfile) i cudzy (PublicProfile).
export function SpontawayTabIcon({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className="h-5 w-5"
      style={{
        display: "block",
        backgroundColor: active ? "#0E0E0E" : "#CFCFCF",
        WebkitMaskImage: "url(/spontaway-symbol.png)",
        maskImage: "url(/spontaway-symbol.png)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
