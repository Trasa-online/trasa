// Zapisy do testow przedpremierowych. Jeden adres na cala aplikacje - do premiery byl
// zduplikowany w PreReleaseBanner i w api/share.ts, wiec podmiana na link do App Store
// wymagalaby pamietania o obu miejscach.
//
// api/share.ts (funkcja brzegowa) ma WLASNA kopie: to osobny bundel, ktory nie importuje
// z src/. Zmieniajac ten adres, zmien go tam takze.
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/a9rtGFuq";
