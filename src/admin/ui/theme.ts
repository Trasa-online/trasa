// Motyw panelu: jasny, ciemny albo "jak system". Wybor pamietamy w tej przegladarce,
// bo operatorki pracuja wieczorami i nie chca go ustawiac za kazdym wejsciem.
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "ops_theme";

const read = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system"; // prywatne okno albo zablokowane cookies
  }
};

/** "system" = zdejmujemy atrybut i oddajemy decyzje media-query z tokens.css. */
const apply = (t: Theme) => {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => { apply(theme); }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch { /* prywatne okno */ }
  }, []);

  return { theme, setTheme };
}

/** Ustawia motyw ZANIM React zamontuje drzewo - bez tego widac mignienie jasnego tla. */
export function applyStoredTheme() {
  apply(read());
}
