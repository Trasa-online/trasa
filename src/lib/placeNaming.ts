import { countryLabel } from "@/lib/tripCountries";
// Domyslne nazwy nowej KOLEKCJI i WYJAZDU (prosba Nat 2026-09-14). Do tej pory arkusz
// tworzenia sklejal same kraje ("Polska · Czechy") albo dawal goly fallback ("Nowa lista"),
// wiec na profilu lezaly pozycje bez sensownego tytulu.
//
// ⚠️ POLSKA ODMIANA. Sklejanie mianownika dawaloby "w Polska" / "do Polska", a reguly
// odmiany nazw wlasnych sa nieregularne (Praga -> w Pradze, Malaga -> w Maladze) - zamiast
// zgadywac trzymamy JAWNE tabele dla nazw, ktore realnie wysylamy (90 krajow z
// TRIP_COUNTRIES + polskie miasta z pickera). Tabele trzymaja CALE frazy z przyimkiem, bo
// sam rzeczownik nie wystarcza: polski uzywa "w Polsce", ale "we Wloszech" (zbitka
// spolglosek) i "na Wegrzech" (Wegry, Slowacja, Litwa, Lotwa, Ukraina + wyspy).
// Czego nie ma w tabeli (miasto wpisane recznie, nowy kraj), dostaje forme bez przyimka:
// "Kolekcja miejsc: X" / "Wyjazd: X" - zawsze poprawna, nigdy polamana.
// Dopisujesz kraj do TRIP_COUNTRIES? Dopisz go tez w OBU tabelach nizej.

// Przyimek jest CZESCIA frazy, bo polski uzywa trzech roznych: "w Polsce", ale "we Wloszech"
// (zbitka spolglosek) i "na Wegrzech" (wyspy + Wegry/Slowacja/Litwa/Lotwa/Ukraina). Trzymanie
// samego rzeczownika dawaloby "w Wloszech" i "w Wegrzech".
// i18n-ignore-start: ponizej TABELE ODMIANY - polskie formy to dane jezykowe, nie copy UI.
/** Gdzie? - fraza z przyimkiem, np. "w Polsce" / "we Wloszech" / "na Wegrzech". */
const LOC_PHRASE: Record<string, string> = {
  // ── kraje: Europa ──
  "Polska": "w Polsce", "Niemcy": "w Niemczech", "Francja": "we Francji", "Hiszpania": "w Hiszpanii",
  "Włochy": "we Włoszech", "Wielka Brytania": "w Wielkiej Brytanii", "Holandia": "w Holandii",
  "Czechy": "w Czechach", "Austria": "w Austrii", "Portugalia": "w Portugalii", "Grecja": "w Grecji",
  "Chorwacja": "w Chorwacji", "Węgry": "na Węgrzech", "Belgia": "w Belgii", "Szwajcaria": "w Szwajcarii",
  "Szwecja": "w Szwecji", "Norwegia": "w Norwegii", "Dania": "w Danii", "Litwa": "na Litwie",
  "Łotwa": "na Łotwie", "Estonia": "w Estonii", "Irlandia": "w Irlandii", "Islandia": "na Islandii",
  "Turcja": "w Turcji", "Finlandia": "w Finlandii", "Słowacja": "na Słowacji", "Słowenia": "w Słowenii",
  "Rumunia": "w Rumunii", "Bułgaria": "w Bułgarii", "Serbia": "w Serbii", "Ukraina": "na Ukrainie",
  "Cypr": "na Cyprze", "Malta": "na Malcie", "Luksemburg": "w Luksemburgu", "Monako": "w Monako",
  "Albania": "w Albanii", "Czarnogóra": "w Czarnogórze",
  "Bośnia i Hercegowina": "w Bośni i Hercegowinie", "Macedonia Północna": "w Macedonii Północnej",
  // ── kraje: Azja ──
  "Japonia": "w Japonii", "Tajlandia": "w Tajlandii", "Wietnam": "w Wietnamie", "Indonezja": "w Indonezji",
  "Zjednoczone Emiraty Arabskie": "w Zjednoczonych Emiratach Arabskich", "Chiny": "w Chinach",
  "Korea Południowa": "w Korei Południowej", "Indie": "w Indiach", "Singapur": "w Singapurze",
  "Malezja": "w Malezji", "Filipiny": "na Filipinach", "Sri Lanka": "na Sri Lance", "Gruzja": "w Gruzji",
  "Kambodża": "w Kambodży", "Nepal": "w Nepalu", "Izrael": "w Izraelu", "Jordania": "w Jordanii",
  "Katar": "w Katarze", "Oman": "w Omanie", "Armenia": "w Armenii", "Azerbejdżan": "w Azerbejdżanie",
  "Kazachstan": "w Kazachstanie", "Malediwy": "na Malediwach", "Mongolia": "w Mongolii",
  // ── kraje: Ameryki ──
  "Stany Zjednoczone": "w Stanach Zjednoczonych", "Kanada": "w Kanadzie", "Meksyk": "w Meksyku",
  "Kuba": "na Kubie", "Kostaryka": "w Kostaryce", "Panama": "w Panamie", "Dominikana": "na Dominikanie",
  "Brazylia": "w Brazylii", "Argentyna": "w Argentynie", "Peru": "w Peru", "Chile": "w Chile",
  "Kolumbia": "w Kolumbii", "Ekwador": "w Ekwadorze", "Boliwia": "w Boliwii", "Urugwaj": "w Urugwaju",
  // ── kraje: Afryka ──
  "Egipt": "w Egipcie", "Maroko": "w Maroku", "Tunezja": "w Tunezji",
  "Republika Południowej Afryki": "w Republice Południowej Afryki", "Kenia": "w Kenii",
  "Tanzania": "w Tanzanii", "Mauritius": "na Mauritiusie", "Seszele": "na Seszelach", "Namibia": "w Namibii",
  // ── kraje: Oceania ──
  "Australia": "w Australii", "Nowa Zelandia": "w Nowej Zelandii", "Fidżi": "na Fidżi",
  // ── polskie miasta (picker miast) ──
  "Warszawa": "w Warszawie", "Kraków": "w Krakowie", "Gdańsk": "w Gdańsku", "Sopot": "w Sopocie",
  "Gdynia": "w Gdyni", "Trójmiasto": "w Trójmieście", "Wrocław": "we Wrocławiu", "Poznań": "w Poznaniu",
  "Łódź": "w Łodzi", "Olsztyn": "w Olsztynie", "Katowice": "w Katowicach", "Lublin": "w Lublinie",
  "Toruń": "w Toruniu", "Szczecin": "w Szczecinie", "Zakopane": "w Zakopanem",
};

/** Dokad? - fraza z przyimkiem, np. "do Polski" / "na Wegry". */
const DIR_PHRASE: Record<string, string> = {
  // ── kraje: Europa ──
  "Polska": "do Polski", "Niemcy": "do Niemiec", "Francja": "do Francji", "Hiszpania": "do Hiszpanii",
  "Włochy": "do Włoch", "Wielka Brytania": "do Wielkiej Brytanii", "Holandia": "do Holandii",
  "Czechy": "do Czech", "Austria": "do Austrii", "Portugalia": "do Portugalii", "Grecja": "do Grecji",
  "Chorwacja": "do Chorwacji", "Węgry": "na Węgry", "Belgia": "do Belgii", "Szwajcaria": "do Szwajcarii",
  "Szwecja": "do Szwecji", "Norwegia": "do Norwegii", "Dania": "do Danii", "Litwa": "na Litwę",
  "Łotwa": "na Łotwę", "Estonia": "do Estonii", "Irlandia": "do Irlandii", "Islandia": "na Islandię",
  "Turcja": "do Turcji", "Finlandia": "do Finlandii", "Słowacja": "na Słowację", "Słowenia": "do Słowenii",
  "Rumunia": "do Rumunii", "Bułgaria": "do Bułgarii", "Serbia": "do Serbii", "Ukraina": "na Ukrainę",
  "Cypr": "na Cypr", "Malta": "na Maltę", "Luksemburg": "do Luksemburga", "Monako": "do Monako",
  "Albania": "do Albanii", "Czarnogóra": "do Czarnogóry",
  "Bośnia i Hercegowina": "do Bośni i Hercegowiny", "Macedonia Północna": "do Macedonii Północnej",
  // ── kraje: Azja ──
  "Japonia": "do Japonii", "Tajlandia": "do Tajlandii", "Wietnam": "do Wietnamu", "Indonezja": "do Indonezji",
  "Zjednoczone Emiraty Arabskie": "do Zjednoczonych Emiratów Arabskich", "Chiny": "do Chin",
  "Korea Południowa": "do Korei Południowej", "Indie": "do Indii", "Singapur": "do Singapuru",
  "Malezja": "do Malezji", "Filipiny": "na Filipiny", "Sri Lanka": "na Sri Lankę", "Gruzja": "do Gruzji",
  "Kambodża": "do Kambodży", "Nepal": "do Nepalu", "Izrael": "do Izraela", "Jordania": "do Jordanii",
  "Katar": "do Kataru", "Oman": "do Omanu", "Armenia": "do Armenii", "Azerbejdżan": "do Azerbejdżanu",
  "Kazachstan": "do Kazachstanu", "Malediwy": "na Malediwy", "Mongolia": "do Mongolii",
  // ── kraje: Ameryki ──
  "Stany Zjednoczone": "do Stanów Zjednoczonych", "Kanada": "do Kanady", "Meksyk": "do Meksyku",
  "Kuba": "na Kubę", "Kostaryka": "do Kostaryki", "Panama": "do Panamy", "Dominikana": "na Dominikanę",
  "Brazylia": "do Brazylii", "Argentyna": "do Argentyny", "Peru": "do Peru", "Chile": "do Chile",
  "Kolumbia": "do Kolumbii", "Ekwador": "do Ekwadoru", "Boliwia": "do Boliwii", "Urugwaj": "do Urugwaju",
  // ── kraje: Afryka ──
  "Egipt": "do Egiptu", "Maroko": "do Maroka", "Tunezja": "do Tunezji",
  "Republika Południowej Afryki": "do Republiki Południowej Afryki", "Kenia": "do Kenii",
  "Tanzania": "do Tanzanii", "Mauritius": "na Mauritius", "Seszele": "na Seszele", "Namibia": "do Namibii",
  // ── kraje: Oceania ──
  "Australia": "do Australii", "Nowa Zelandia": "do Nowej Zelandii", "Fidżi": "na Fidżi",
  // ── polskie miasta (picker miast) ──
  "Warszawa": "do Warszawy", "Kraków": "do Krakowa", "Gdańsk": "do Gdańska", "Sopot": "do Sopotu",
  "Gdynia": "do Gdyni", "Trójmiasto": "do Trójmiasta", "Wrocław": "do Wrocławia", "Poznań": "do Poznania",
  "Łódź": "do Łodzi", "Olsztyn": "do Olsztyna", "Katowice": "do Katowic", "Lublin": "do Lublina",
  "Toruń": "do Torunia", "Szczecin": "do Szczecina", "Zakopane": "do Zakopanego",
};
// i18n-ignore-end

export interface NamingStrings {
  /** PL: "Kolekcja miejsc {{place}}" - {{place}} niesie JUZ przyimek ("w Polsce").
   *  EN: "Places in {{place}}" - bez odmiany, wiec przyimek siedzi w szablonie. */
  collectionIn: string;
  /** "Kolekcja miejsc: {{place}}" */  collectionPlain: string;
  /** PL: "Wyjazd {{place}}" ({{place}} = "do Polski" / "na Wegry"); EN: "Trip to {{place}}". */
  tripTo: string;
  /** "Wyjazd: {{place}}" */           tripPlain: string;
  /** "Nowa kolekcja" */               collectionFallback: string;
  /** "Nowy wyjazd" */                 tripFallback: string;
  /** true dla polskiego - tylko wtedy odmieniamy */ declines: boolean;
}

const fill = (tpl: string, place: string) => tpl.replace("{{place}}", place);

/**
 * Nazwa dla nowej kolekcji / wyjazdu.
 *
 * @param city      miasto, jesli znane (dzis arkusz tworzenia go NIE zbiera - picker wybiera
 *                  wylacznie kraje - ale ListScopeSheet i przyszly krok miasta juz moga)
 * @param countries kraje wybrane w pickerze
 */
function buildName(
  kind: "collection" | "trip",
  city: string | null | undefined,
  countries: string[],
  s: NamingStrings,
): string {
  const named = (city ?? "").trim() || (countries.length === 1 ? countries[0].trim() : "");
  // Kilka krajow naraz: nie sklejamy "do Polski i Czech" (odmiana laczna + spojniki), tylko
  // forma z dwukropkiem - czytelna i zawsze poprawna.
  if (!named) {
    if (countries.length > 1) {
      const joined = countries.map(countryLabel).join(" · ");
      return fill(kind === "collection" ? s.collectionPlain : s.tripPlain, joined);
    }
    return kind === "collection" ? s.collectionFallback : s.tripFallback;
  }
  if (!s.declines) {
    // EN: kraj z danych jest po polsku (klucz) - na ekran idzie jego angielska nazwa.
    return fill(kind === "collection" ? s.collectionIn : s.tripTo, countryLabel(named));
  }
  const table = kind === "collection" ? LOC_PHRASE : DIR_PHRASE;
  const declined = table[named];
  if (!declined) {
    // Nieznana nazwa (miasto wpisane recznie, nowy kraj) - bez przyimka, zeby nie wyszlo
    // "Kolekcja miejsc w Kutno" / "Wyjazd do Kutno".
    return fill(kind === "collection" ? s.collectionPlain : s.tripPlain, named);
  }
  return fill(kind === "collection" ? s.collectionIn : s.tripTo, declined);
}

export const collectionName = (city: string | null | undefined, countries: string[], s: NamingStrings) =>
  buildName("collection", city, countries, s);

export const tripName = (city: string | null | undefined, countries: string[], s: NamingStrings) =>
  buildName("trip", city, countries, s);
