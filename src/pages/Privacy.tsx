import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 text-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">Polityka Prywatności</h1>
      </header>

      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6 text-sm leading-relaxed">

        <section>
          <h2 className="font-bold text-base mb-2">1. Administrator danych osobowych</h2>
          <p className="text-muted-foreground">
            Administratorem Twoich danych osobowych przetwarzanych w&nbsp;ramach aplikacji Trasa (dalej: „Aplikacja") jest Bartosz Tomala, e-mail:{" "}
            <a href="mailto:tomalab97@gmail.com" className="underline">tomalab97@gmail.com</a> (dalej: „Operator" lub „Administrator").
          </p>
          <p className="text-muted-foreground mt-2">
            Niniejsza polityka opisuje, jakie dane zbieramy, w&nbsp;jakim celu i&nbsp;na jakiej podstawie prawnej.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Jakie dane zbieramy</h2>
          <p className="text-muted-foreground">W&nbsp;ramach korzystania z&nbsp;Aplikacji zbieramy:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>adres e-mail i&nbsp;imię (przy rejestracji),</li>
            <li>nazwę użytkownika i&nbsp;zdjęcie profilowe,</li>
            <li>historię tras, odwiedzonych miejsc i&nbsp;Twoich reakcji na miejsca,</li>
            <li>preferencje podróżnicze (na potrzeby personalizacji),</li>
            <li>zdjęcia dodawane do dziennika podróży,</li>
            <li>identyfikator urządzenia i&nbsp;informacje techniczne (typ urządzenia, system, wersja Aplikacji).</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Jeżeli logujesz się przez Apple lub Google, Operator otrzymuje od tych dostawców Twój adres e-mail oraz publiczne imię. Nie otrzymujemy hasła ani innych danych z&nbsp;Twojego konta Apple/Google.
          </p>
          <p className="text-muted-foreground mt-2">
            W&nbsp;wersji mobilnej (iOS) Aplikacja może prosić o&nbsp;dostęp do <strong>kamery</strong> i&nbsp;<strong>biblioteki zdjęć</strong> w&nbsp;celu zrobienia lub wybrania zdjęcia profilowego oraz zdjęć do dziennika. Dostęp ten jest opcjonalny i&nbsp;w&nbsp;każdej chwili możesz cofnąć zgodę w&nbsp;ustawieniach systemowych iOS.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Podstawy prawne i&nbsp;cele przetwarzania</h2>
          <p className="text-muted-foreground">Dane przetwarzamy:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>w&nbsp;celu świadczenia usług, prowadzenia konta i&nbsp;realizacji funkcji Aplikacji - art. 6 ust. 1 lit. b RODO (wykonanie umowy),</li>
            <li>w&nbsp;celach analitycznych, statystycznych i&nbsp;ulepszania Aplikacji - art. 6 ust. 1 lit. a RODO (zgoda),</li>
            <li>w&nbsp;zakresie profilowania AI i&nbsp;personalizacji rekomendacji - art. 6 ust. 1 lit. a RODO (zgoda),</li>
            <li>w&nbsp;celach związanych z&nbsp;bezpieczeństwem Aplikacji - art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Profilowanie AI</h2>
          <p className="text-muted-foreground">
            Aplikacja tworzy spersonalizowany profil Twoich preferencji podróżniczych na podstawie reakcji na miejsca i&nbsp;historii tras.
          </p>
          <p className="text-muted-foreground mt-2">
            Profilowanie odbywa się wyłącznie za Twoją wyraźną zgodą udzieloną podczas konfiguracji konta. Możesz wycofać tę zgodę w&nbsp;dowolnym momencie w&nbsp;Ustawieniach Aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            Profilowanie ma charakter rekomendacyjny - nie wywołuje wobec Ciebie skutków prawnych ani w&nbsp;podobny sposób istotnie na Ciebie nie wpływa (art. 22 RODO).
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Okres przechowywania danych</h2>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>przez okres posiadania konta użytkownika,</li>
            <li>do 30 dni po usunięciu konta (na potrzeby techniczne i&nbsp;bezpieczeństwa),</li>
            <li>dane analityczne PostHog - zgodnie z&nbsp;ustawieniami narzędzia (domyślnie 12-14 miesięcy),</li>
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
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Analityka i&nbsp;technologie śledzące</h2>
          <p className="text-muted-foreground">
            Aplikacja korzysta z&nbsp;narzędzi analitycznych wyłącznie po udzieleniu przez Ciebie wyraźnej zgody (cookie banner).
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>PostHog</strong> - analiza zachowań użytkowników (odwiedzane podstrony, czas trwania sesji, typ urządzenia, interakcje z&nbsp;interfejsem). Hostowane na serwerach w&nbsp;Unii Europejskiej (eu.posthog.com).
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Microsoft Clarity</strong> (opcjonalnie, po zgodzie) - rejestracja sesji w&nbsp;celu identyfikacji błędów i&nbsp;problemów z&nbsp;użytecznością.
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
            <li><strong>Google Gemini</strong> - przetwarzanie AI w&nbsp;celu dopasowania miejsc i&nbsp;generowania rekomendacji,</li>
            <li><strong>Google Maps / Google Places API</strong> - mapy i&nbsp;wyszukiwanie miejsc (przekazujemy zapytanie tekstowe, np. nazwę miasta),</li>
            <li><strong>Apple (Sign in with Apple)</strong> - opcjonalne logowanie przez Apple ID,</li>
            <li><strong>Google (OAuth)</strong> - opcjonalne logowanie przez konto Google,</li>
            <li><strong>PostHog</strong> - analityka behawioralna (serwery w&nbsp;UE),</li>
            <li><strong>Vercel</strong> - hosting aplikacji webowej (serwery w&nbsp;UE),</li>
            <li><strong>Resend</strong> - dostarczanie wiadomości e-mail (powiadomienia, reset hasła).</li>
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
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Zobacz również: <Link to="/terms" className="underline">Regulamin Aplikacji</Link>
        </p>

        <p className="text-xs text-muted-foreground">
          Ostatnia aktualizacja: maj 2026
        </p>
      </div>
    </div>
  );
};

export default Privacy;
