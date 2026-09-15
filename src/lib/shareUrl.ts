export const SHARE_BASE_URL = "https://spontaway.com";

export const buildShareUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Wyjazd i lista dostaja KROTKI adres (/r/<id>, /l/<id>) obslugiwany serwerowo przez
  // api/share.ts. Tylko dzieki temu link ma wlasny podglad w komunikatorach: adres z hashem
  // (/#/route/<id>) nigdy nie dociera do serwera, wiec robot Facebooka widzial dla kazdego
  // linku ten sam ogolny baner marki. Reszta sciezek zostaje na hashu.
  // /miejsce/<id> (wizytowka) -> /p/<id> (2026-09-11).
  const m = /^\/(route|lista|miejsce)\/([0-9a-f-]{36})$/i.exec(cleanPath);
  if (m) {
    const kind = m[1].toLowerCase();
    return `${SHARE_BASE_URL}/${kind === "route" ? "r" : kind === "lista" ? "l" : "p"}/${m[2]}`;
  }
  return `${SHARE_BASE_URL}/#${cleanPath}`;
};
