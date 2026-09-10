// Stabilna referencja pustej listy dla domyslek react-query.
//
// `const { data: xs = [] } = useQuery(...)` wyglada niewinnie, ale `[]` to NOWA tablica przy
// KAZDYM renderze. Dopoki `data` jest undefined - czyli w trakcie ladowania, a przy zapytaniu
// z `enabled: false` w nieskonczonosc - kazdy efekt, ktory ma `xs` w zaleznosciach, odpala sie
// co render. Jesli taki efekt wola setState, mamy petle renderowania.
//
// Zlapane dwa razy na produkcyjnym kodzie (2026-09-10): piny w widoku wyjazdu (petla przez
// cale ladowanie, 168 obrotow) i konta biznesowe w arkuszu zapraszania, gdzie zapytanie jest
// wylaczone do czasu otwarcia arkusza - tam petla krecila sie BEZ KONCA, 657 obrotow w 7 s.
//
// `as never[]` pozwala uzyc jej jako domyslki dla listy dowolnego typu bez rzutowan w miejscu
// uzycia. Tablica jest zamrozona, zeby przypadkowy `push` nie zatrul wszystkich odbiorcow.
export const EMPTY_ARRAY = Object.freeze([]) as never[];
