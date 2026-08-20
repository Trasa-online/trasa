// Pusty stan zakladki "Miejsca" (lista/trasa bez zadnego miejsca). Peachy znak spontaway "S"
// (maska CSS -> peachy #ef9d78, spojne z ikonami kategorii) + tytul + podpowiedz. Owner dostaje
// hint o guziku "Dodaj nowe miejsce"; gosc widzi neutralny komunikat. Wspoldzielone: SharedList + SharedRoute.
export function EmptyPlacesState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span
        aria-hidden
        className="block"
        style={{
          width: 88,
          height: 88,
          backgroundColor: "#ef9d78",
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
      <p className="text-base font-bold text-foreground mt-4">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[240px]">{hint}</p>
    </div>
  );
}

export default EmptyPlacesState;
