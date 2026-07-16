# Wywiady z userami po wyjeździe

**Cel główny:** walidacja wartości - czy Trasa realnie pomaga odkrywać/planować, czy to ładny gadżet.
**Format:** 2 userów, testowali apkę na realnym wyjeździe.
**Data:** _______________

---

## Część 1: Ściąga do wywiadu

Kolejność jest celowa: fakty i zachowania → twardy test wartości → dopiero na końcu opinie
i "co byś zmienił" (żeby wcześniej nie ustawić rozmówcy).

### 1. Rozgrzewka / kontekst (fakty, nie oceny)
- [ ] Opowiedz o tym wyjeździe - dokąd, z kim, na jak długo?
- [ ] Kiedy pierwszy raz odpaliłeś Trasę: przed wyjazdem czy na miejscu?
- [ ] *Pokaż mi* ostatnią rzecz, którą w niej zrobiłeś (niech przejdzie na żywo - zobaczysz gdzie się gubi, a nie gdzie myśli, że się gubi)

### 2. Jak używali
- [ ] Do czego konkretnie jej użyłeś - planowanie, szukanie w trakcie, dziennik?
- [ ] Solo czy razem z kimś?

### 3. 🎯 Test wartości (serce wywiadu - tu spędź najwięcej czasu)
- [ ] Trafiłeś przez Trasę na miejsce, którego sam byś nie znalazł? Byłeś tam realnie?
- [ ] Jak normalnie planujesz taki wyjazd (Google Maps? Instagram? znajomi?) - co Trasa zrobiła **lepiej**, a co **gorzej** niż Twój zwykły sposób?
- [ ] Gdyby jutro Trasa zniknęła, czego by Ci zabrakło? (albo: wzruszyłbyś ramionami?)
- [ ] Był moment "o, fajne"? Co się wtedy działo?

### 4. Sygnał behawioralny (mocniejszy niż deklaracja)
- [ ] Wróciłeś do apki drugi/trzeci raz z własnej woli, czy tylko bo Cię o test poprosiłam?
- [ ] Komu konkretnie byś to pokazał i jakimi słowami byś opisał?

### 5. Problemy + "jedna rzecz" (świadomie na końcu)
- [ ] Był moment, że prawie odłożyłeś apkę? Co się działo?
- [ ] Gdybyś mógł zmienić jedną rzecz - jaką?
  - Follow-up ZAWSZE: "a co próbowałeś wtedy osiągnąć?" (potrzebujesz problemu, nie ich rozwiązania)

### 3 zasady prowadzenia
- **Milcz po pytaniu.** Cisza wyciąga więcej niż dopytywanie.
- **Kop w konkret:** "mówisz że fajne - opowiedz o konkretnym momencie".
- **Uważaj na grzeczność.** Testowali dla Ciebie, będą mili. Pytania behawioralne (pkt 4) omijają to, bo pytają o to co *zrobili*, nie co *myślą*.

---

## Część 2: Metryki i progi walidacji

> ⚠️ **N=2 - to nie są statystyki.** To sygnały binarne (0/1/2) i progi ustalone Z GÓRY,
> żeby po wywiadach nie racjonalizować odpowiedzi. Traktuj jako hipotezy do dalszej weryfikacji,
> nie jako dowód. Ale samo spisanie progów *przed* rozmową jest wartościowe.

### A. Sygnały wartości - zaznacz per user (max 2)

| Sygnał | User 1 | User 2 | Próg "OK" |
|---|---|---|---|
| **Discovery hit:** odkrył miejsce, którego sam by nie znalazł, I TAM BYŁ | ☐ | ☐ | ≥1 z 2 |
| **Trasa > zwykły sposób:** wskazał konkret, w czym lepsza od Maps/IG | ☐ | ☐ | ≥1 z 2 |
| **Zniknięcie boli:** "zabrakłoby mi X" (nie: wzruszenie ramion) | ☐ | ☐ | ≥1 z 2 |
| **Powrót dobrowolny:** otworzył apkę bez proszenia o test | ☐ | ☐ | ≥1 z 2 |
| **Opisuje sam z siebie** apkę spójnie z pozycjonowaniem | ☐ | ☐ | sygnał |

### B. Pytanie PMF (Sean Ellis) - zadaj obu wprost
> "Jak byś się poczuł, gdybyś nie mógł już używać Trasy?"
> a) bardzo zawiedziony  b) trochę zawiedziony  c) obojętnie

- User 1: ______  User 2: ______
- *(Benchmark PMF to ~40% "bardzo zawiedziony" na dużej próbie - przy N=2 to tylko wskazówka, ale odpowiedź "obojętnie" od obu = czerwona flaga.)*

### C. Countable proxy (do wpisania po wywiadzie)
- Liczba miejsc odkrytych przez apkę i realnie odwiedzonych: U1 ___ / U2 ___
- Liczba otwarć apki "z własnej woli": U1 ___ / U2 ___
- Liczba wskazanych problemów/friction: U1 ___ / U2 ___

### Interpretacja (ustalona z góry)
- **Wartość potwierdzona (kierunkowo):** oba usery mają discovery hit + PMF ≥ "trochę zawiedziony"
- **Sygnał mieszany:** 1 z 2 na kluczowych sygnałach → drąż CZYM się różnią te osoby
- **Czerwona flaga:** żaden discovery hit LUB oba "obojętnie" w PMF → wartość niepotwierdzona, wróć do propozycji wartości

---

## Część 2.5: Metodologia i próba

### Ile osób i po co (dwa różne cele = dwie różne liczby)

- **Wykrywanie problemów UI (usability):** ~5 osób ≈ 85% problemów, 7 osób ≈ 92%
  (Nielsen & Landauer 1993, wzór `1-(1-L)^n`, L≈31%). Dotyczy JEDNORODNEJ grupy
  robiącej podobne zadanie.
- **Walidacja wartości / nasycenie tematów (mój główny cel):** ~12 wywiadów = nasycenie,
  ~6 = większość tematów (Guest, Bunce & Johnson 2006, "How many interviews are enough?").
  → docelowe **8-12 osób** trafia w ten przedział. "Zdecydowana powtarzalność tematów"
  = operacyjna definicja nasycenia.

### ⚠️ Segmentacja bije wielkość próby
Powyższe liczby zakładają jednorodną grupę. Trasa ma różne światy:
- **solo vs grupowo** (fundamentalnie inny use case)
- planista-z-wyprzedzeniem vs spontaniczny-na-miejscu

Reguła: **~5 osób NA SEGMENT**, który realnie chcę walidować. Jeśli zmieszam segmenty,
10 osób rozmyje się na grupki po 2-3 i w żadnej nie osiągnę nasycenia.

**Decyzja przed startem zbierania - który segment waliduję?**
- ☐ solo   ☐ grupowo   ☐ oba (→ celuj w 10-12, świadomie ~5 na tryb)

### ⚠️ Rozłożone w czasie = oznaczaj wersję
Zbieram przez tygodnie, a apka się zmienia. User #9 testuje inną wersję niż user #1.
Przy każdym userze notuj **wersję/datę buildu**, żeby nie zliczać do jednej puli
feedbacku o funkcji, której wcześniejsi userzy nie widzieli.

### Tracker próby

| # | Data | Segment (solo/grupa) | Wersja/build | PMF (b/t/o) | Discovery hit? | Notatki |
|---|---|---|---|---|---|---|
| 1 |   |   |   |   |   |   |
| 2 |   |   |   |   |   |   |
| 3 |   |   |   |   |   |   |
| 4 |   |   |   |   |   |   |
| 5 |   |   |   |   |   |   |
| 6 |   |   |   |   |   |   |
| 7 |   |   |   |   |   |   |
| 8 |   |   |   |   |   |   |
| 9 |   |   |   |   |   |   |
| 10 |   |   |   |   |   |   |

---

## Część 3: Zalążek schematu kodowania (do analizy po wywiadach)

Kategorie a-priori (spodziewane) - dopisuj emergentne w trakcie kodowania:

**Wartość / value**
- `value/discovery` - odkrycie nowego miejsca
- `value/vs-alternatives` - porównanie do Maps / IG / znajomych
- `value/group` - wartość trybu grupowego
- `value/diary` - dziennik / pocztówki

**Friction**
- `friction/onboarding`
- `friction/nawigacja`
- `friction/pusty-stan` (miasto bez miejsc)
- `friction/bug`

**Język / pozycjonowanie**
- `lang/jak-nazywa` - jakimi słowami sam opisuje apkę
- `lang/dla-kogo` - komu by polecił

**Feature requests** (surowe - pamiętaj: to rozwiązania, szukaj problemu za nimi)
- `req/...`

> Zasada kodowania: 1 wypowiedź może mieć wiele tagów. Emergentne kategorie (pojawiające się
> nieplanowanie) są często najciekawsze - notuj je osobno.

---

## Notatki surowe

### User 1
_______________

### User 2
_______________
