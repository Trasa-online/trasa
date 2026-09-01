export const SHARE_BASE_URL = "https://spontaway.com";

export const buildShareUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Wyjazd i lista dostaja KROTKI adres (/r/<id>, /l/<id>) obslugiwany serwerowo przez
  // api/share.ts. Tylko dzieki temu link ma wlasny podglad w komunikatorach: adres z hashem
  // (/#/route/<id>) nigdy nie dociera do serwera, wiec robot Facebooka widzial dla kazdego
  // linku ten sam ogolny baner marki. Reszta sciezek zostaje na hashu.
  const m = /^\/(route|lista)\/([0-9a-f-]{36})$/i.exec(cleanPath);
  if (m) return `${SHARE_BASE_URL}/${m[1].toLowerCase() === "route" ? "r" : "l"}/${m[2]}`;
  return `${SHARE_BASE_URL}/#${cleanPath}`;
};
