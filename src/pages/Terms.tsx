import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 text-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">Regulamin i Polityka Prywatności</h1>
      </header>

      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-bold text-base mb-2">1. Postanowienia ogólne</h2>
          <p className="text-muted-foreground">
            Aplikacja TRASA (dalej: „Aplikacja") jest narzędziem do planowania podróży i prowadzenia dziennika
            turystycznego. Operatorem Aplikacji jest jej twórca, dalej zwany „Operatorem". Korzystanie z Aplikacji
            oznacza akceptację niniejszego regulaminu.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Rejestracja i konto</h2>
          <p className="text-muted-foreground">
            Aby korzystać z Aplikacji, wymagana jest rejestracja z podaniem adresu e-mail i hasła. Użytkownik
            zobowiązuje się podać prawdziwe dane i chronić dostęp do swojego konta. Konto jest przeznaczone wyłącznie
            do użytku osobistego. Minimalny wiek do rejestracji to 13 lat.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Zakres usług</h2>
          <p className="text-muted-foreground">
            TRASA umożliwia: planowanie tras i wycieczek z pomocą AI, zapisywanie miejsc i pinezek na mapie,
            prowadzenie dziennika podróży przez rozmowę z asystentem AI, przeglądanie własnych zapisanych tras.
            Aplikacja jest dostępna bezpłatnie w wersji beta. Operator zastrzega prawo do zmiany zakresu usług.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Ochrona danych osobowych (RODO)</h2>
          <p className="text-muted-foreground">
            Administratorem danych osobowych jest Operator. Dane zbierane przez Aplikację obejmują: adres e-mail,
            nazwę użytkownika, historię tras i odwiedzonych miejsc, treści rozmów z asystentem AI (przechowywane
            wyłącznie w celu polepszenia jakości planowania). Dane są przetwarzane na podstawie zgody użytkownika
            (art. 6 ust. 1 lit. a RODO) oraz w celu wykonania umowy (art. 6 ust. 1 lit. b RODO).
          </p>
          <p className="text-muted-foreground mt-2">
            Użytkownik ma prawo do: dostępu do swoich danych, ich poprawienia, usunięcia („prawo do bycia
            zapomnianym"), przenoszenia danych, wniesienia skargi do UODO. Aby skorzystać z tych praw, należy
            skontaktować się z Operatorem przez ustawienia aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Cookies i analityka (Google Analytics)</h2>
          <p className="text-muted-foreground">
            Aplikacja korzysta z plików cookies (ciasteczek) Google Analytics 4 w celu analizy ruchu i poprawy jakości
            usługi. Pliki cookies analityczne są ustawiane wyłącznie po udzieleniu przez Ciebie wyraźnej zgody poprzez
            baner cookie widoczny przy pierwszym uruchomieniu aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Jakie dane zbiera Google Analytics:</strong> anonimizowane adresy IP, odwiedzane podstrony,
            czas trwania sesji, typ urządzenia i przeglądarki. Dane te nie pozwalają na bezpośrednią identyfikację
            użytkownika.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Przekazanie danych do USA:</strong> Google Analytics przetwarza dane na serwerach Google LLC
            (USA). Przekazanie odbywa się na podstawie standardowych klauzul umownych (art. 46 RODO)
            oraz Ram Ochrony Danych UE–USA (EU-U.S. Data Privacy Framework). Administratorem danych jest Google
            Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlandia.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Okres przechowywania:</strong> domyślnie 14 miesięcy, po czym dane są automatycznie usuwane
            przez Google.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Jak wycofać zgodę:</strong> możesz w każdej chwili odmówić lub wycofać zgodę na cookies
            analityczne poprzez ustawienia przeglądarki, wtyczkę Google Analytics Opt-out
            (tools.google.com/dlpage/gaoptout) lub kontaktując się z nami w celu usunięcia zapisanej zgody.
            Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania dokonanego przed jej wycofaniem.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Przetwarzanie przez podmioty trzecie</h2>
          <p className="text-muted-foreground">
            Aplikacja korzysta z następujących usług zewnętrznych:
          </p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>Supabase — baza danych i uwierzytelnianie (serwery w UE)</li>
            <li>Google Gemini (przez Lovable AI Gateway) — generowanie planów tras i przetwarzanie dziennika</li>
            <li>Google Maps / Google Places API — wyświetlanie map i wyszukiwanie miejsc</li>
            <li>Google Analytics 4 — analiza ruchu (za zgodą; patrz punkt 5)</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Treści rozmów z AI mogą być przekazywane do wyżej wymienionych usług wyłącznie w celu realizacji funkcji
            Aplikacji i nie są wykorzystywane do celów marketingowych.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Treści użytkownika</h2>
          <p className="text-muted-foreground">
            Użytkownik zachowuje prawa do treści, które dodaje do Aplikacji (opisy, zdjęcia, notatki). Operator nie
            rości sobie praw do tych treści. Użytkownik zobowiązuje się nie dodawać treści naruszających prawo lub
            prawa osób trzecich.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Odpowiedzialność</h2>
          <p className="text-muted-foreground">
            Aplikacja jest dostępna w fazie beta. Operator nie gwarantuje nieprzerwanego działania usługi ani
            poprawności planów generowanych przez AI. Plany tras należy weryfikować przed podróżą. Operator nie
            ponosi odpowiedzialności za decyzje podjęte na podstawie sugestii AI.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Zmiany regulaminu</h2>
          <p className="text-muted-foreground">
            Operator zastrzega prawo do zmiany regulaminu. O istotnych zmianach użytkownicy zostaną poinformowani
            przez aplikację. Dalsze korzystanie z Aplikacji po wejściu zmian w życie oznacza ich akceptację.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">10. Kontakt</h2>
          <p className="text-muted-foreground">
            W sprawach dotyczących regulaminu, danych osobowych lub usunięcia konta skontaktuj się z nami przez
            sekcję Ustawienia w aplikacji.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Ostatnia aktualizacja: marzec 2026
        </p>
      </div>
    </div>
  );
};

export default Terms;
