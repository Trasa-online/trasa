import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LegalShell from "@/pages/legal/LegalShell";

// POLITYKA PRYWATNOSCI - PL i EN (prosba Nat 2026-09-24). Dokument idzie za jezykiem APLIKACJI,
// obie wersje leza w jednym pliku - polityka, ktorej wersje jezykowe mieszkaja osobno,
// rozjezdza sie przy pierwszej poprawce.
//
// Kontakt: `admin@spontaway.com` we wszystkim, co dotyczy DANYCH OSOBOWYCH (wybor Nat),
// `hello@spontaway.com` w pozostalych sprawach.
//
// ⚠️ Lista narzedzi i podmiotow trzecich ma byc zgodna ze STANEM FAKTYCZNYM: sa tu Sentry
// (bledy, bez zgody - uzasadniony interes), Google Analytics i Vercel Analytics (strona www),
// Apple APNs (push), Google Cloud Vision (sprawdzanie zdjec), Anthropic (tlumaczenia
// na zadanie) i Lovable AI. Dokladajac narzedzie dotykajace danych usera - dopisz je TUTAJ,
// w OBU jezykach. Polityka, ktora nie wymienia realnego procesora, jest gorsza niz jej brak.

const Privacy = () => {
  const { i18n } = useTranslation();
  const en = (i18n.language ?? "pl").toLowerCase().startsWith("en");
  return <LegalShell title={en ? "Privacy Policy" : "Polityka Prywatności"}>{en ? <PrivacyEn /> : <PrivacyPl />}</LegalShell>;
};

const PrivacyPl = () => (
  <>
        <section>
          <h2 className="font-bold text-base mb-2">1. Administrator danych osobowych</h2>
          <p className="text-muted-foreground">
            Administratorem Twoich danych osobowych przetwarzanych w&nbsp;ramach aplikacji <strong>spontaway</strong> (dalej: „Aplikacja") jest Bartosz Tomala, e-mail:{" "}
            <a href="mailto:admin@spontaway.com" className="underline">admin@spontaway.com</a> (dalej: „Operator" lub „Administrator").
          </p>
          <p className="text-muted-foreground mt-2">
            Niniejsza polityka opisuje, jakie dane zbieramy, w&nbsp;jakim celu i&nbsp;na jakiej podstawie prawnej.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Jakie dane zbieramy</h2>
          <p className="text-muted-foreground">W&nbsp;ramach korzystania z&nbsp;Aplikacji zbieramy:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>adres e-mail i&nbsp;imię (z logowania Apple lub Google),</li>
            <li>nazwę użytkownika i&nbsp;zdjęcie profilowe,</li>
            <li>Twoje plany podróży i&nbsp;kolekcje miejsc, zapisane i&nbsp;polubione treści oraz reakcje na miejsca,</li>
            <li>oznaczenia miejsc jako odwiedzonych (zapisujemy sam fakt i&nbsp;nazwę miejsca, bez Twoich współrzędnych),</li>
            <li>relacje społeczne: kogo obserwujesz, zaproszenia do znajomych, uczestnictwo we wspólnych planach i&nbsp;kolekcjach, wiadomości na czacie planu,</li>
            <li>odpowiedzi ankietowe podane podczas onboardingu (np. skąd znasz Aplikację, w&nbsp;jakim celu z&nbsp;niej korzystasz, płeć - podanie płci jest dobrowolne),</li>
            <li>zdjęcia i&nbsp;notatki dodawane do miejsc, planów oraz kolekcji,</li>
            <li>token powiadomień push (jeśli wyrazisz na nie zgodę),</li>
            <li>identyfikator urządzenia i&nbsp;informacje techniczne (typ urządzenia, system, wersja Aplikacji).</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Jeżeli logujesz się przez Apple lub Google, Operator otrzymuje od tych dostawców Twój adres e-mail oraz publiczne imię. Nie otrzymujemy hasła ani innych danych z&nbsp;Twojego konta Apple/Google.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Lokalizacja.</strong> Jeśli wyrazisz zgodę, Aplikacja odczytuje Twoje położenie, aby pokazać odległość do miejsc i&nbsp;ułożyć je od najbliższego. Położenie jest używane <strong>na urządzeniu</strong> i&nbsp;nie jest zapisywane na naszych serwerach ani nikomu udostępniane. Zgodę możesz w&nbsp;każdej chwili cofnąć w&nbsp;ustawieniach systemowych.
          </p>
          <p className="text-muted-foreground mt-2">
            W&nbsp;wersji mobilnej (iOS) Aplikacja może prosić o&nbsp;dostęp do <strong>kamery</strong> i&nbsp;<strong>biblioteki zdjęć</strong> w&nbsp;celu zrobienia lub wybrania zdjęcia profilowego oraz zdjęć do planu. Dostęp ten jest opcjonalny i&nbsp;w&nbsp;każdej chwili możesz cofnąć zgodę w&nbsp;ustawieniach systemowych iOS.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Podstawy prawne i&nbsp;cele przetwarzania</h2>
          <p className="text-muted-foreground">Dane przetwarzamy:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>w&nbsp;celu świadczenia usług, prowadzenia konta i&nbsp;realizacji funkcji Aplikacji - art. 6 ust. 1 lit. b RODO (wykonanie umowy),</li>
            <li>w&nbsp;celach analitycznych, statystycznych i&nbsp;ulepszania Aplikacji - art. 6 ust. 1 lit. a RODO (zgoda),</li>
            <li>w&nbsp;celu personalizacji (m.in. kolejności prezentowanych miejsc) na podstawie Twoich interakcji - art. 6 ust. 1 lit. a RODO (zgoda),</li>
            <li>w&nbsp;celu tłumaczenia treści, gdy sam poprosisz o&nbsp;tłumaczenie (guzik „Przetłumacz") - art. 6 ust. 1 lit. b RODO,</li>
            <li>w&nbsp;celu automatycznego sprawdzania zdjęć pod kątem treści nieodpowiednich oraz moderacji zgłoszeń - art. 6 ust. 1 lit. f RODO (bezpieczeństwo użytkowników),</li>
            <li>w&nbsp;celu wysyłania powiadomień push - art. 6 ust. 1 lit. a RODO (zgoda udzielana w&nbsp;systemie),</li>
            <li>w&nbsp;celu wykrywania i&nbsp;naprawiania błędów oraz bezpieczeństwa Aplikacji - art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Personalizacja</h2>
          <p className="text-muted-foreground">
            Aplikacja może dopasowywać prezentowane treści (m.in. kolejność miejsc) na podstawie Twoich interakcji - zapisanych i&nbsp;polubionych miejsc oraz reakcji.
          </p>
          <p className="text-muted-foreground mt-2">
            Personalizacja odbywa się wyłącznie za Twoją wyraźną zgodą, którą możesz wycofać w&nbsp;dowolnym momencie w&nbsp;Ustawieniach Aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            Personalizacja ma charakter pomocniczy - nie wywołuje wobec Ciebie skutków prawnych ani w&nbsp;podobny sposób istotnie na Ciebie nie wpływa (art. 22 RODO).
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Okres przechowywania danych</h2>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>przez okres posiadania konta użytkownika,</li>
            <li>plany i&nbsp;kolekcje usunięte przez Ciebie - 7 dni w&nbsp;Koszu (możesz je przywrócić), potem kasowane bezpowrotnie,</li>
            <li>do 30 dni po usunięciu konta (na potrzeby techniczne i&nbsp;bezpieczeństwa),</li>
            <li>dane analityczne PostHog - zgodnie z&nbsp;ustawieniami narzędzia (domyślnie 12-14 miesięcy),</li>
            <li>zgłoszenia błędów (Sentry) - do 90 dni,</li>
            <li>tłumaczenia treści - przechowujemy wynik tłumaczenia, żeby nie tłumaczyć tego samego dwa razy,</li>
            <li>kopie zapasowe - do 30 dni od ich utworzenia.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Twoje prawa</h2>
          <p className="text-muted-foreground">Przysługują Ci prawa do:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>dostępu do swoich danych,</li>
            <li>ich sprostowania,</li>
            <li>usunięcia (możesz w&nbsp;każdej chwili usunąć konto w&nbsp;Ustawieniach),</li>
            <li>ograniczenia przetwarzania,</li>
            <li>przenoszenia danych,</li>
            <li>sprzeciwu wobec przetwarzania,</li>
            <li>wycofania zgody w&nbsp;dowolnym momencie (bez wpływu na zgodność z&nbsp;prawem przetwarzania przed wycofaniem),</li>
            <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (<a href="https://uodo.gov.pl" target="_blank" rel="noreferrer" className="underline">uodo.gov.pl</a>).</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Aby zrealizować swoje prawa, skontaktuj się z&nbsp;nami pod adresem{" "}
            <a href="mailto:admin@spontaway.com" className="underline">admin@spontaway.com</a>.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Analityka i&nbsp;technologie śledzące</h2>
          <p className="text-muted-foreground">
            Aplikacja korzysta z&nbsp;narzędzi analitycznych wyłącznie po udzieleniu przez Ciebie wyraźnej zgody (w&nbsp;aplikacji mobilnej podczas onboardingu, w&nbsp;wersji webowej przez baner zgody). Zgodę możesz zmienić w&nbsp;Ustawieniach.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>PostHog</strong> - analiza zachowań użytkowników (odwiedzane ekrany, czas trwania sesji, typ urządzenia, interakcje z&nbsp;interfejsem). Serwery w&nbsp;Unii Europejskiej (eu.posthog.com).
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Google Analytics 4</strong> (strona internetowa) - statystyka odwiedzin. Działa w&nbsp;trybie zgody: bez Twojej zgody nie zapisuje danych na urządzeniu.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Microsoft Clarity</strong> (tylko strona internetowa, po zgodzie) - rejestracja sesji w&nbsp;celu identyfikacji błędów i&nbsp;problemów z&nbsp;użytecznością. W&nbsp;aplikacji mobilnej Clarity nie działa.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Vercel Analytics i&nbsp;Speed Insights</strong> (tylko strona internetowa) - zagregowane statystyki odwiedzin i&nbsp;szybkości ładowania, bez identyfikowania osób.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Sentry</strong> - zgłoszenia błędów Aplikacji (rodzaj błędu, ekran, wersja, model urządzenia). Działa NIEZALEŻNIE od zgody na analitykę, na podstawie prawnie uzasadnionego interesu - bez tych zgłoszeń nie da się naprawiać awarii. Serwery w&nbsp;Unii Europejskiej (region DE).
          </p>
          <p className="text-muted-foreground mt-2">
            Zgodę na analitykę możesz wycofać w&nbsp;dowolnym momencie w&nbsp;Ustawieniach Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Podmioty trzecie</h2>
          <p className="text-muted-foreground">Korzystamy z&nbsp;następujących dostawców usług, którym powierzamy przetwarzanie danych:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li><strong>Supabase</strong> - baza danych i&nbsp;uwierzytelnianie (serwery w&nbsp;UE),</li>
            <li><strong>Google Maps / Google Places API</strong> - mapy i&nbsp;wyszukiwanie miejsc (przekazujemy zapytanie tekstowe, np. nazwę miasta),</li>
            <li><strong>Apple (Sign in with Apple)</strong> - opcjonalne logowanie przez Apple ID,</li>
            <li><strong>Google (OAuth)</strong> - opcjonalne logowanie przez konto Google,</li>
            <li><strong>PostHog</strong> - analityka behawioralna (serwery w&nbsp;UE),</li>
            <li><strong>Vercel</strong> - hosting aplikacji webowej (serwery w&nbsp;UE),</li>
            <li><strong>Resend</strong> - dostarczanie wiadomości e-mail (powiadomienia, aktywacja i&nbsp;reset hasła konta lokalu),</li>
            <li><strong>Apple (APNs)</strong> - dostarczanie powiadomień push na urządzenia iOS,</li>
            <li><strong>Google Cloud Vision</strong> - automatyczne sprawdzanie zdjęć pod kątem treści nieodpowiednich (przekazujemy adres zdjęcia),</li>
            <li><strong>Anthropic</strong> - tłumaczenie treści na Twoje żądanie (przekazujemy wyłącznie tekst, który prosisz przetłumaczyć, bez danych konta),</li>
            <li><strong>Lovable AI</strong> - funkcje wspierane przez AI (m.in. podpowiedzi przy planowaniu, rozpoznawanie miejsca ze zdjęcia), gdy z&nbsp;nich korzystasz,</li>
            <li><strong>Sentry</strong> - zgłoszenia błędów Aplikacji (serwery w&nbsp;UE),</li>
            <li><strong>Microsoft Clarity</strong> - nagrania sesji na stronie internetowej, po zgodzie.</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Dane są przekazywane wyłącznie w&nbsp;zakresie niezbędnym do działania Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Przekazywanie danych poza EOG</h2>
          <p className="text-muted-foreground">
            Część dostawców (np. Google, Apple, PostHog Cloud) może przetwarzać dane w&nbsp;Stanach Zjednoczonych lub innych krajach poza Europejskim Obszarem Gospodarczym. Transfery odbywają się na podstawie:
          </p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>decyzji Komisji Europejskiej o&nbsp;adekwatności (Data Privacy Framework dla USA),</li>
            <li>standardowych klauzul umownych (SCC) zatwierdzonych przez Komisję Europejską,</li>
            <li>innych odpowiednich mechanizmów zgodnych z&nbsp;art. 46 RODO.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">10. Bezpieczeństwo danych</h2>
          <p className="text-muted-foreground">
            Stosujemy odpowiednie środki techniczne i&nbsp;organizacyjne w&nbsp;celu ochrony Twoich danych, w&nbsp;tym:
          </p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>szyfrowanie transmisji (HTTPS / TLS 1.2+),</li>
            <li>szyfrowanie haseł (bcrypt),</li>
            <li>kontrola dostępu do bazy danych (Row Level Security),</li>
            <li>regularne kopie zapasowe.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">11. Usunięcie konta i&nbsp;danych</h2>
          <p className="text-muted-foreground">
            Możesz trwale usunąć swoje konto i&nbsp;wszystkie powiązane dane bezpośrednio z&nbsp;poziomu Ustawień Aplikacji. Operacja jest <strong>nieodwracalna</strong>.
          </p>
          <p className="text-muted-foreground mt-2">
            Po usunięciu konta zachowujemy minimum danych technicznych przez 30 dni (na wypadek potrzeby przywrócenia w&nbsp;sytuacjach awaryjnych), po czym są one trwale kasowane.
          </p>
          <p className="text-muted-foreground mt-2">
            Treści, które przed usunięciem konta dodałeś do <strong>wspólnych</strong> planów i&nbsp;kolekcji, mogą pozostać widoczne dla ich pozostałych uczestników - tak samo jak wiadomości wysłane na czacie. Przed usunięciem konta Aplikacja pokazuje, co zniknie na zawsze, a&nbsp;co zostaje u&nbsp;innych.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">12. Zmiany polityki</h2>
          <p className="text-muted-foreground">
            Operator zastrzega prawo do zmiany niniejszej polityki. O&nbsp;istotnych zmianach poinformujemy Cię w&nbsp;Aplikacji lub mailowo.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">13. Kontakt</h2>
          <p className="text-muted-foreground">
            W&nbsp;sprawach dotyczących ochrony danych osobowych skontaktuj się z&nbsp;Administratorem pod adresem:{" "}
            <a href="mailto:admin@spontaway.com" className="underline">admin@spontaway.com</a>.
          </p>
          <p className="text-muted-foreground mt-2">
            W&nbsp;pozostałych sprawach (działanie Aplikacji, reklamacje, zgłoszenia treści) pisz na{" "}
            <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Zobacz również: <Link to="/terms" className="underline">Regulamin Aplikacji</Link>
        </p>

        <p className="text-xs text-muted-foreground">
          Ostatnia aktualizacja: 24 września 2026
        </p>
  </>
);

const PrivacyEn = () => (
  <>
    <section>
      <h2 className="font-bold text-base mb-2">1. Data controller</h2>
      <p className="text-muted-foreground">
        The controller of your personal data processed in the <strong>spontaway</strong> app (the „App") is Bartosz Tomala, e-mail:{" "}
        <a href="mailto:admin@spontaway.com" className="underline">admin@spontaway.com</a> (the „Operator" or „Controller").
      </p>
      <p className="text-muted-foreground mt-2">
        This policy describes what data we collect, for what purpose and on what legal basis.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">2. What data we collect</h2>
      <p className="text-muted-foreground">When you use the App we collect:</p>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li>your e-mail address and first name (from Apple or Google sign-in),</li>
        <li>your username and profile photo,</li>
        <li>your trip plans and place collections, saved and liked content, and your reactions to places,</li>
        <li>places you mark as visited (we store the fact and the name of the place, without your coordinates),</li>
        <li>social connections: who you follow, friend requests, membership in shared plans and collections, messages in a plan chat,</li>
        <li>onboarding survey answers (for example how you heard about the App, what you use it for, gender - giving it is optional),</li>
        <li>photos and notes you add to places, plans and collections,</li>
        <li>a push notification token (if you allow notifications),</li>
        <li>device identifier and technical information (device type, system, App version).</li>
      </ul>
      <p className="text-muted-foreground mt-2">
        If you sign in with Apple or Google, the Operator receives your e-mail address and public first name from them. We do not receive your password or any other data from your Apple/Google account.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Location.</strong> With your consent, the App reads your location to show the distance to places and order them from the nearest. The location is used <strong>on your device</strong>, is not stored on our servers and is not shared with anyone. You can withdraw this consent at any time in your system settings.
      </p>
      <p className="text-muted-foreground mt-2">
        On mobile (iOS) the App may ask for access to the <strong>camera</strong> and <strong>photo library</strong> in order to take or pick a profile photo and photos for a plan. This access is optional and you can withdraw it at any time in iOS settings.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">3. Legal bases and purposes</h2>
      <p className="text-muted-foreground">We process data:</p>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li>to provide the service, run your account and deliver App features - Art. 6(1)(b) GDPR (performance of a contract),</li>
        <li>for analytics, statistics and improving the App - Art. 6(1)(a) GDPR (consent),</li>
        <li>for personalisation (including the order of places shown) based on your interactions - Art. 6(1)(a) GDPR (consent),</li>
        <li>to translate content when you ask for a translation (the „Translate" button) - Art. 6(1)(b) GDPR,</li>
        <li>to screen photos automatically for inappropriate content and to moderate reports - Art. 6(1)(f) GDPR (user safety),</li>
        <li>to send push notifications - Art. 6(1)(a) GDPR (consent given in the system),</li>
        <li>to detect and fix errors and to keep the App secure - Art. 6(1)(f) GDPR (legitimate interest).</li>
      </ul>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">4. Personalisation</h2>
      <p className="text-muted-foreground">
        The App may adapt what it shows you (including the order of places) based on your interactions - saved and liked places and your reactions.
      </p>
      <p className="text-muted-foreground mt-2">
        Personalisation happens only with your explicit consent, which you can withdraw at any time in App Settings.
      </p>
      <p className="text-muted-foreground mt-2">
        Personalisation is auxiliary - it does not produce legal effects concerning you or similarly significantly affect you (Art. 22 GDPR).
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">5. How long we keep data</h2>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li>for as long as you have an account,</li>
        <li>plans and collections you delete - 7 days in the Trash (you can restore them), then deleted permanently,</li>
        <li>up to 30 days after account deletion (for technical and security reasons),</li>
        <li>PostHog analytics data - according to the tool's settings (12-14 months by default),</li>
        <li>error reports (Sentry) - up to 90 days,</li>
        <li>content translations - we keep the result so the same text is not translated twice,</li>
        <li>backups - up to 30 days from creation.</li>
      </ul>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">6. Your rights</h2>
      <p className="text-muted-foreground">You have the right to:</p>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li>access your data,</li>
        <li>rectify it,</li>
        <li>erase it (you can delete your account at any time in Settings),</li>
        <li>restrict processing,</li>
        <li>data portability,</li>
        <li>object to processing,</li>
        <li>withdraw consent at any time (without affecting the lawfulness of processing before withdrawal),</li>
        <li>lodge a complaint with the President of the Polish Personal Data Protection Office (<a href="https://uodo.gov.pl" target="_blank" rel="noreferrer" className="underline">uodo.gov.pl</a>).</li>
      </ul>
      <p className="text-muted-foreground mt-2">
        To exercise your rights, contact us at{" "}
        <a href="mailto:admin@spontaway.com" className="underline">admin@spontaway.com</a>.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">7. Analytics and tracking technologies</h2>
      <p className="text-muted-foreground">
        The App uses analytics tools only after you give explicit consent (in the mobile app during onboarding, on the website through the consent banner). You can change your consent in Settings.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>PostHog</strong> - analysis of user behaviour (screens visited, session length, device type, interface interactions). Servers in the European Union (eu.posthog.com).
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Google Analytics 4</strong> (website) - visit statistics. It runs in consent mode: without your consent it does not store data on your device.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Microsoft Clarity</strong> (website only, after consent) - session recording to identify errors and usability problems. Clarity does not run in the mobile app.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Vercel Analytics and Speed Insights</strong> (website only) - aggregated visit and loading-speed statistics, without identifying individuals.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Sentry</strong> - App error reports (error type, screen, version, device model). It runs INDEPENDENTLY of analytics consent, on the basis of legitimate interest - without these reports crashes cannot be fixed. Servers in the European Union (DE region).
      </p>
      <p className="text-muted-foreground mt-2">
        You can withdraw analytics consent at any time in App Settings.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">8. Third parties</h2>
      <p className="text-muted-foreground">We use the following service providers, who process data on our behalf:</p>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li><strong>Supabase</strong> - database and authentication (servers in the EU),</li>
        <li><strong>Google Maps / Google Places API</strong> - maps and place search (we send the text query, for example a city name),</li>
        <li><strong>Apple (Sign in with Apple)</strong> - optional sign-in with an Apple ID,</li>
        <li><strong>Google (OAuth)</strong> - optional sign-in with a Google account,</li>
        <li><strong>PostHog</strong> - behavioural analytics (servers in the EU),</li>
        <li><strong>Vercel</strong> - web app hosting (servers in the EU),</li>
        <li><strong>Resend</strong> - e-mail delivery (notifications, venue account activation and password reset),</li>
        <li><strong>Apple (APNs)</strong> - delivery of push notifications to iOS devices,</li>
        <li><strong>Google Cloud Vision</strong> - automated screening of photos for inappropriate content (we send the photo URL),</li>
        <li><strong>Anthropic</strong> - translating content at your request (we send only the text you ask to translate, without account data),</li>
        <li><strong>Lovable AI</strong> - AI-supported features (including planning suggestions and recognising a place from a photo) when you use them,</li>
        <li><strong>Sentry</strong> - App error reports (servers in the EU),</li>
        <li><strong>Microsoft Clarity</strong> - website session recording, after consent.</li>
      </ul>
      <p className="text-muted-foreground mt-2">
        Data is shared only to the extent necessary for the App to work.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">9. Transfers outside the EEA</h2>
      <p className="text-muted-foreground">
        Some providers (for example Google, Apple, PostHog Cloud) may process data in the United States or other countries outside the European Economic Area. Transfers take place on the basis of:
      </p>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li>European Commission adequacy decisions (the Data Privacy Framework for the USA),</li>
        <li>standard contractual clauses (SCC) approved by the European Commission,</li>
        <li>other appropriate safeguards under Art. 46 GDPR.</li>
      </ul>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">10. Data security</h2>
      <p className="text-muted-foreground">
        We apply appropriate technical and organisational measures to protect your data, including:
      </p>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li>encrypted transmission (HTTPS / TLS 1.2+),</li>
        <li>password hashing (bcrypt),</li>
        <li>database access control (Row Level Security),</li>
        <li>regular backups.</li>
      </ul>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">11. Deleting your account and data</h2>
      <p className="text-muted-foreground">
        You can permanently delete your account and all related data straight from App Settings. The operation is <strong>irreversible</strong>.
      </p>
      <p className="text-muted-foreground mt-2">
        After deletion we keep a minimum of technical data for 30 days (in case recovery is needed in an emergency), after which it is permanently erased.
      </p>
      <p className="text-muted-foreground mt-2">
        Content you added to <strong>shared</strong> plans and collections before deleting your account may remain visible to the other participants - the same applies to messages sent in a chat. Before deletion the App shows what disappears for good and what stays with others.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">12. Changes to this policy</h2>
      <p className="text-muted-foreground">
        The Operator may change this policy. We will inform you about significant changes in the App or by e-mail.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">13. Contact</h2>
      <p className="text-muted-foreground">
        For personal data matters, contact the Controller at{" "}
        <a href="mailto:admin@spontaway.com" className="underline">admin@spontaway.com</a>.
      </p>
      <p className="text-muted-foreground mt-2">
        For anything else (how the App works, complaints, content reports) write to{" "}
        <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
      </p>
    </section>

    <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
      See also: <Link to="/terms" className="underline">Terms of Service</Link>
    </p>

    <p className="text-xs text-muted-foreground">
      Last updated: 24 September 2026
    </p>
  </>
);

export default Privacy;
