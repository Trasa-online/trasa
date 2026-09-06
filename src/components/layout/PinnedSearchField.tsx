import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

// Przypięte pole wyszukiwania w górnej belce (2026-09-06, po testach z userami).
// Wcześniej wyszukiwarka kryła się pod lupą - user musiał wiedzieć, że tam jest.
// Teraz pole stoi na stałe w belce Eksploracji i na profilu.
//
// Dwa tryby:
//  - interaktywny (Eksploracja): kontrolowany input, rodzic trzyma frazę,
//  - `readOnly` (Profil): wygląda jak pole, ale jest guzikiem - tap przenosi do
//    Eksploracji z otwartą wyszukiwarką (jedno miejsce z wynikami, jedna logika).
//
// Wysokość 36px (h-9) = ta sama co pozostałe akcje w belce, więc belka nie rośnie
// (ważne: wysokość karty 9:16 w swiperze liczy się ze stałego chrome - CLAUDE.md).
type Props = {
  value?: string;
  onChange?: (v: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
};

const PinnedSearchField = forwardRef<HTMLInputElement, Props>(function PinnedSearchField(
  { value = "", onChange, onFocus, placeholder = "Szukaj", autoFocus, readOnly, onClick, ...rest },
  ref,
) {
  const { t } = useTranslation("common");
  const shell =
    "flex-1 min-w-0 flex items-center gap-2 px-3 h-9 rounded-full bg-muted/70 border border-border/50 transition-colors";

  if (readOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={rest["aria-label"] ?? placeholder}
        className={`${shell} text-left active:scale-[0.98] active:bg-muted`}
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 min-w-0 truncate text-[15px] text-muted-foreground/70">{placeholder}</span>
      </button>
    );
  }

  return (
    <div className={`${shell} focus-within:border-orange-400/60 focus-within:bg-background`}>
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={rest["aria-label"] ?? placeholder}
        className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.("")}
          aria-label={t("clear")}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted active:scale-90 transition"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

export default PinnedSearchField;
