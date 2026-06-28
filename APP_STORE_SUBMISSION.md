# App Store - pakiet submisyjny (iOS, PL)

> Wszystko gotowe do wklejenia w App Store Connect. Apka wychodzi po polsku; EN w kolejnym buildzie.
> Stan: iOS na TestFlight (Build 6). Do submisji produkcyjnej brakuje listingu + nowego builda z fixami.

---

## 0. NAJPIERW: build do wysłania ⚠️

Build 6 (na TestFlight) **nie ma** ostatnich fixów (`NSLocationAlwaysAndWhenInUseUsageDescription`,
`ITSAppUsesNonExemptEncryption`). Zrób świeży:

1. W Xcode podbij **Build number** na **7** (musi być > 6).
2. Upewnij się że MARKETING_VERSION = **1.0**.
3. `npm run check:both` → Xcode: Product → Archive → Distribute → App Store Connect.
4. Po przetworzeniu wybierz **Build 7** w wersji 1.0 do submisji.

---

## 1. App Information

| Pole | Wartość |
|---|---|
| **Nazwa** | Trasa: odkrywaj i zwiedzaj |
| **Subtitle** (max 30) | speed dating z miastem |
| **Kategoria główna** | Travel |
| **Kategoria dodatkowa** | Lifestyle |
| **Copyright** | © 2026 Trasa |
| **Age rating** | Wypełnij kwestionariusz UCZCIWIE. Apka pokazuje bary/kluby (miejsca) → w pytaniu "Alcohol, Tobacco, or Drug Use or References" wybierz **Infrequent/Mild** → wynik prawdopodobnie **12+**. NIE deklaruj 4+ (treści o alkoholu = ryzyko flagi). |

## 2. URL-e

| Pole | Wartość |
|---|---|
| **Privacy Policy URL** | https://trasa.travel/#/privacy |
| **Support URL** | https://trasa.travel |
| **Marketing URL** | https://trasa.travel |

> Sprawdź że `https://trasa.travel/#/privacy` i `/#/terms` otwierają się publicznie (są na allowliście).

## 3. Promotional Text (max 170)

```
Zaplanuj dzień w mieście w kilka minut - solo albo z grupą. Przeglądaj miejsca, twórz trasy, nawiguj od punktu do punktu i zapisuj wspomnienia w dzienniku podróży.
```

## 4. Description (PL)

```
Trasa to najszybszy sposób, żeby zaplanować idealny dzień w mieście. Przeglądasz miejsca, dodajesz te które Cię ciekawią, a Trasa układa z nich gotową trasę w dobrej kolejności i pokazuje ją na mapie.

SOLO ALBO Z GRUPĄ
Planuj sam albo zaproś znajomych kodem. Każdy przegląda miejsca po swojemu, a Trasa zbiera Wasze wspólne dopasowania i tworzy jedną trasę dla całej ekipy.

W TRAKCIE PODRÓŻY
Nawiguj od punktu do punktu, odhaczaj odwiedzone miejsca i dodawaj własne notatki o tym, co warto wiedzieć.

DZIENNIK PODRÓŻY
Każda ukończona trasa trafia do Twojego dziennika jako wspomnienie - z miejscami, które odwiedziłeś.

DLA KOGO
Dla każdego, kto chce odkrywać miasto bez godzin ślęczenia nad planem - w pojedynkę, we dwoje albo z całą paczką znajomych.

Pobierz Trasę i zobacz, co miasto ma dla Ciebie.
```

## 5. Keywords (max 100, bez spacji)

```
podróże,trasy,miasto,plan,dziennik,grupa,planowanie,zwiedzanie,wyjazd,wycieczka,znajomi
```

## 6. App Privacy (nutrition labels)

**Czy zbierasz dane?** TAK. **Czy używasz do śledzenia (tracking)?** NIE (PostHog = analityka first-party, brak SDK reklamowych, brak ATT).

Zadeklaruj następujące typy danych:

| Typ danych | Cel | Powiązane z userem? | Tracking? |
|---|---|---|---|
| **Contact Info → Email** (OAuth Google/Apple) | App Functionality | Tak | Nie |
| **Contact Info → Name** (imię w profilu) | App Functionality | Tak | Nie |
| **User Content → Photos** (awatar, zdjęcia w dzienniku) | App Functionality | Tak | Nie |
| **User Content → Other** (notatki o miejscach) | App Functionality | Tak | Nie |
| **Identifiers → User ID** (Supabase) | App Functionality, Analytics | Tak | Nie |
| **Usage Data → Product Interaction** (zdarzenia PostHog) | Analytics | Tak | Nie |
| **Diagnostics → Crash/Performance** (PostHog exceptions) | Analytics | Tak | Nie |

**Lokalizacja: NIE deklaruj jako zbieranej.** Apka czyta GPS tylko na pierwszym planie do liczenia
dystansu **na urządzeniu** - współrzędne nigdzie nie są wysyłane ani zapisywane (Apple liczy jako
"collected" tylko dane wysyłane poza urządzenie). Permission string w Info.plist już jest.

Third parties (service providers, nie tracking): Supabase (backend), PostHog (analytics), Google
(Places/Maps), Resend (email).

## 7. App Review - notatki dla recenzenta

```
Trasa to aplikacja do planowania jednodniowych tras po mieście (solo lub grupowo).

LOGOWANIE: aplikacja używa "Sign in with Apple" oraz Google. Recenzent może zalogować się
przez Sign in with Apple swoim Apple ID, albo użyć opcji "Kontynuuj jako gość", żeby przejrzeć
aplikację bez konta.

GŁÓWNY FLOW: ekran główny → guzik "+" → "Zaplanuj solo" → wybór miasta (Warszawa odblokowana) →
przeglądanie miejsc → "Zaproponuj trasę" → gotowa trasa na mapie.

Lokalizacja jest opcjonalna (używana tylko do pokazania dystansu, liczona na urządzeniu).
```

> Jeśli wolisz dać dedykowane konto testowe zamiast Sign in with Apple - powiedz, ogarniemy
> testowy login (ale OAuth-only utrudnia; guest mode + Sign in with Apple powinny wystarczyć).

## 8. Screenshoty (wymagane)

- **6.7"** (1290×2796) - **wymagane**, min 3 (zrób 5-6).
- **6.5"** (1242×2688) - zalecane.
- **App icon** 1024×1024 PNG, **bez alpha/przezroczystości**.

Proponowane ekrany (best foot forward):
1. Swiper miejsc (karta 9:16, ładne zdjęcie) - "przeglądaj miejsca"
2. Gotowa trasa na mapie - "trasa w dobrej kolejności"
3. Parowanie grupowe (awatary + dopasowania) - "planuj z grupą"
4. Aktywna trasa z nawigacją (Nawiguj/odhacz) - "w trakcie podróży"
5. Dziennik / wspomnienie - "zapisuj wspomnienia"

> Captura: symulator iPhone 15 Pro Max (6.7") → Cmd+S, albo realny sprzęt. Można dodać tekst/ramki
> (np. w Figmie), ale czyste screeny też przejdą.

## 9. Checklist przed "Submit for Review"

- [ ] Build 7 wgrany i wybrany (z fixami plist)
- [ ] Subtitle, description, keywords, promo text wklejone
- [ ] 3 URL-e ustawione + sprawdzone że się otwierają
- [ ] App Privacy wypełnione (tabela wyżej) + "Not used to track you"
- [ ] Age rating questionnaire (prawdopodobnie 12+)
- [ ] Screenshoty 6.7" (min 3) + icon 1024
- [ ] Review notes wklejone
- [ ] Sign in with Apple działa na realnym sprzęcie (Apple to sprawdza)
- [ ] Export compliance: auto (ITSAppUsesNonExemptEncryption=false już w plist)
- [ ] Submit for Review → release: manual albo automatic

## 10. Ryzyka odrzucenia (na co uważać)

- **OAuth-only login** - Apple wymaga Sign in with Apple jeśli oferujesz Google. JEST. ✅ Upewnij się że działa na realnym iPhonie (najczęstszy powód rejecta dla OAuth apek).
- **Guest mode** - recenzent musi móc wejść do apki; "Kontynuuj jako gość" to zapewnia. ✅
- **Pusta zawartość** - miasta inne niż Warszawa pokazują pusty stan. Recenzent użyje Warszawy (odblokowana, pełna danych). Zaznacz to w notatkach (zrobione).
- **Privacy policy** - musi być dostępna pod URL. ✅
- **Treści alkoholowe** (bary) - dlatego 12+, nie 4+.
