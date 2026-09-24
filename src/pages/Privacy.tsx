import { useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { scrollDocumentToTop } from "@/lib/scrollTop";

// POLITYKA PRYWATNOSCI. Przeglad 2026-09-24 (prosba Nat): marka „spontaway", kontakt na
// hello@spontaway.com, a lista narzedzi i podmiotow trzecich doprowadzona do stanu
// FAKTYCZNEGO - doszly Sentry (bledy, bez zgody, uzasadniony interes), Google Analytics
// i Vercel Analytics (strona www), Apple APNs (push), Google Cloud Vision (sprawdzanie
// zdjec), Anthropic (tlumaczenia na zadanie) i Lovable AI (funkcje AI).
//
// ⚠️ Dopisujac do apki NOWE narzedzie, ktore dotyka danych uzytkownika, dopisz je TUTAJ -
// polityka, ktora nie wymienia realnego procesora, jest gorsza niz jej brak.
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const navigate = useNavigate();
  // Dokument zawsze otwiera sie OD POCZATKU - takze gdy przyszlismy z drugiego
  // dokumentu ze srodka jego tresci (patrz scrollDocumentToTop).
  useLayoutEffect(() => { scrollDocumentToTop(); }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-3 flex items-center gap-3">
        <button onClick={() => goBackOr(navigate, "/")} className="p-1 text-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">Polityka Prywatności</h1>
      </header>

      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6 text-sm leading-relaxed">

        <section>
          <h2 className="font-bold text-base mb-2">1. Administrator danych osobowych</h2>
          <p className="text-muted-foreground">
            Administratorem Twoich danych osobowych przetwarzanych w&nbsp;ramach aplikacji <strong>spontaway</strong> (dalej: „Aplikacja") jest Bartosz Tomala, e-mail:{" "}
            <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a> (dalej: „Operator" lub „Administrator").
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
            <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
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
            <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Zobacz również: <Link to="/terms" className="underline">Regulamin Aplikacji</Link>
        </p>

        <p className="text-xs text-muted-foreground">
          Ostatnia aktualizacja: 24 września 2026
        </p>
      </div>
    </div>
  );
};

export default Privacy;
