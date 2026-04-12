import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 text-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">Regulamin i Polityka Prywatności</h1>
      </header>

      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6 text-sm leading-relaxed">

        <section>
          <h2 className="font-bold text-base mb-2">1. Postanowienia ogólne</h2>
          <p className="text-muted-foreground">
            Aplikacja Trasa (dalej: „Aplikacja") jest narzędziem do planowania podróży i prowadzenia dziennika turystycznego.
          </p>
          <p className="text-muted-foreground mt-2">
            Administratorem Aplikacji oraz administratorem danych osobowych jest Bartosz Tomala, e-mail:{" "}
            <a href="mailto:tomalab97@gmail.com" className="underline">tomalab97@gmail.com</a> (dalej: „Operator").
          </p>
          <p className="text-muted-foreground mt-2">
            Korzystanie z Aplikacji oznacza akceptację niniejszego regulaminu.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Rejestracja i konto</h2>
          <p className="text-muted-foreground">
            Aby korzystać z Aplikacji, wymagana jest rejestracja z podaniem adresu e-mail i hasła.
          </p>
          <p className="text-muted-foreground mt-2">
            Użytkownik zobowiązuje się podać prawdziwe dane i chronić dostęp do swojego konta. Konto jest przeznaczone wyłącznie do użytku osobistego.
          </p>
          <p className="text-muted-foreground mt-2">
            Minimalny wiek do rejestracji wynosi <strong>16 lat</strong> (zgodnie z art. 8 RODO oraz polską ustawą o ochronie danych osobowych). Osoby poniżej 16 roku życia nie mogą korzystać z Aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            Operator ma prawo zawiesić lub usunąć konto użytkownika w przypadku naruszenia niniejszego regulaminu, przepisów prawa lub działań mogących zagrażać bezpieczeństwu Aplikacji lub innych użytkowników.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Zakres usług</h2>
          <p className="text-muted-foreground">Aplikacja umożliwia:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>planowanie tras i wycieczek z pomocą AI,</li>
            <li>prowadzenie dziennika podróży przez rozmowę z asystentem AI,</li>
            <li>prowadzenie dziennika podróży w formie zapisanych tras, recenzji odwiedzonych miejsc oraz udostępnionych przez siebie zdjęć,</li>
            <li>przeglądanie własnych zapisanych tras, recenzji oraz zdjęć.</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Aplikacja jest dostępna bezpłatnie w wersji beta. Operator zastrzega prawo do zmiany zakresu usług.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Ochrona danych osobowych (RODO)</h2>
          <p className="text-muted-foreground">Administratorem danych osobowych jest Operator.</p>
          <p className="text-muted-foreground mt-2">Dane zbierane przez Aplikację obejmują:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>adres e-mail,</li>
            <li>nazwę użytkownika,</li>
            <li>historię tras i odwiedzonych miejsc,</li>
            <li>preferencje podróżnicze,</li>
            <li>treści rozmów z asystentem AI,</li>
            <li>udostępnione przez użytkownika zdjęcia.</li>
          </ul>
          <p className="text-muted-foreground mt-2">Dane są przetwarzane:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>w celu świadczenia usług i prowadzenia konta użytkownika (art. 6 ust. 1 lit. b RODO),</li>
            <li>w celach analitycznych i statystycznych – na podstawie zgody (art. 6 ust. 1 lit. a RODO),</li>
            <li>w zakresie profilowania AI – na podstawie zgody (art. 6 ust. 1 lit. a RODO).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Profilowanie AI</h2>
          <p className="text-muted-foreground">
            Aplikacja tworzy spersonalizowany profil preferencji podróżniczych na podstawie Twoich reakcji na miejsca, historii tras i rozmów z asystentem.
          </p>
          <p className="text-muted-foreground mt-2">
            Profilowanie odbywa się wyłącznie za Twoją wyraźną zgodą udzieloną podczas konfiguracji konta. Możesz wycofać tę zgodę w dowolnym momencie w Ustawieniach.
          </p>
          <p className="text-muted-foreground mt-2">
            Profilowanie nie wywołuje skutków prawnych ani w podobny sposób istotnie na Ciebie nie wpływa (art. 22 RODO).
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Okres przechowywania danych</h2>
          <p className="text-muted-foreground">Dane są przechowywane:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>przez okres posiadania konta użytkownika,</li>
            <li>do 30 dni po jego usunięciu (w celach technicznych i bezpieczeństwa),</li>
            <li>dane analityczne – zgodnie z ustawieniami narzędzi (np. do 14 miesięcy).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Prawa użytkownika</h2>
          <p className="text-muted-foreground">Przysługują Ci prawa do:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>dostępu do danych,</li>
            <li>ich poprawienia,</li>
            <li>usunięcia,</li>
            <li>ograniczenia przetwarzania,</li>
            <li>przenoszenia danych,</li>
            <li>sprzeciwu wobec przetwarzania,</li>
            <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Zabezpieczenia</h2>
          <p className="text-muted-foreground">
            Operator stosuje odpowiednie środki techniczne i organizacyjne w celu ochrony danych osobowych, w tym szyfrowanie transmisji (HTTPS) oraz kontrolę dostępu do danych.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Usunięcie konta</h2>
          <p className="text-muted-foreground">
            Możesz trwale usunąć swoje konto i wszystkie powiązane dane bezpośrednio z poziomu Ustawień. Operacja jest nieodwracalna.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Analityka i technologie śledzące</h2>
          <p className="text-muted-foreground">
            Aplikacja korzysta z narzędzi analitycznych wyłącznie po udzieleniu przez Ciebie wyraźnej zgody.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Google Analytics 4</strong> — analiza ruchu: anonimizowane adresy IP, odwiedzane podstrony, czas trwania sesji, typ urządzenia.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Microsoft Clarity</strong> — nagrania sesji i mapy ciepła (heatmaps), obejmujące kliknięcia, przewijanie i interakcje z interfejsem.
          </p>
          <p className="text-muted-foreground mt-2">
            Dane mogą być przekazywane poza Europejski Obszar Gospodarczy (np. do USA) na podstawie standardowych klauzul umownych oraz odpowiednich mechanizmów zgodnych z RODO.
          </p>
          <p className="text-muted-foreground mt-2">
            Zgoda na analitykę może zostać wycofana w dowolnym momencie w ustawieniach Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Przetwarzanie przez podmioty trzecie</h2>
          <p className="text-muted-foreground">Aplikacja korzysta z następujących usług zewnętrznych:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>Supabase — baza danych i uwierzytelnianie</li>
            <li>Google Gemini — przetwarzanie zapytań AI</li>
            <li>Google Maps / Google Places API — mapy i wyszukiwanie miejsc</li>
            <li>Google Analytics 4 — analiza ruchu</li>
            <li>Microsoft Clarity — analiza zachowań użytkowników</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Dane są przekazywane wyłącznie w zakresie niezbędnym do działania Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Treści użytkownika</h2>
          <p className="text-muted-foreground">
            Użytkownik zachowuje prawa do treści, które dodaje do Aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            Użytkownik zobowiązuje się nie dodawać treści naruszających prawo lub prawa osób trzecich.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Odpowiedzialność</h2>
          <p className="text-muted-foreground">Aplikacja jest dostępna w fazie beta.</p>
          <p className="text-muted-foreground mt-2">
            Operator nie gwarantuje nieprzerwanego działania usługi ani poprawności planów generowanych przez AI.
          </p>
          <p className="text-muted-foreground mt-2">
            Wyniki generowane przez AI mają charakter pomocniczy i mogą zawierać błędy.
          </p>
          <p className="text-muted-foreground mt-2">
            Operator nie ponosi odpowiedzialności za decyzje podjęte na podstawie sugestii Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Reklamacje</h2>
          <p className="text-muted-foreground">
            Użytkownik może zgłaszać reklamacje dotyczące działania Aplikacji na adres e-mail{" "}
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
          <p className="text-muted-foreground mt-2">
            Reklamacje będą rozpatrywane w terminie do 14 dni.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">10. Zmiany regulaminu</h2>
          <p className="text-muted-foreground">
            Operator zastrzega prawo do zmiany regulaminu.
          </p>
          <p className="text-muted-foreground mt-2">
            O istotnych zmianach użytkownicy zostaną poinformowani poprzez Aplikację.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">11. Prawo właściwe</h2>
          <p className="text-muted-foreground">
            Regulamin podlega prawu polskiemu.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">12. Kontakt</h2>
          <p className="text-muted-foreground">
            W sprawach dotyczących regulaminu lub danych osobowych skontaktuj się z Operatorem pod adresem e-mail:{" "}
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Ostatnia aktualizacja: kwiecień 2026
        </p>
      </div>
    </div>
  );
};

export default Terms;
