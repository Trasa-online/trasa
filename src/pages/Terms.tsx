import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 text-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">Regulamin</h1>
      </header>

      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6 text-sm leading-relaxed">

        <Link
          to="/privacy"
          className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors"
        >
          <Shield className="h-4 w-4 text-orange-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Polityka Prywatności</p>
            <p className="text-xs text-muted-foreground">Jakie dane zbieramy i&nbsp;jak je chronimy</p>
          </div>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>

        <section>
          <h2 className="font-bold text-base mb-2">1. Postanowienia ogólne</h2>
          <p className="text-muted-foreground">
            spontaway (dalej: „Aplikacja") to aplikacja do odkrywania miejsc i&nbsp;tras po mieście: użytkownicy przeglądają gotowe trasy stworzone przez innych, inspirują się nimi, tworzą własne trasy z&nbsp;ulubionych miejsc i&nbsp;zapisują je.
          </p>
          <p className="text-muted-foreground mt-2">
            Operatorem Aplikacji jest Bartosz Tomala, e-mail:{" "}
            <a href="mailto:tomalab97@gmail.com" className="underline">tomalab97@gmail.com</a> (dalej: „Operator").
          </p>
          <p className="text-muted-foreground mt-2">
            Korzystanie z&nbsp;Aplikacji oznacza akceptację niniejszego regulaminu.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Rejestracja i&nbsp;konto</h2>
          <p className="text-muted-foreground">
            Korzystanie z&nbsp;Aplikacji wymaga zalogowania się przez konto <strong>Apple</strong> lub <strong>Google</strong>. Konta biznesowe (wizytówki lokali) zakładane są osobno, przez adres e-mail.
          </p>
          <p className="text-muted-foreground mt-2">
            Użytkownik zobowiązuje się podać prawdziwe dane i&nbsp;chronić dostęp do swojego konta. Konto przeznaczone jest do użytku osobistego.
          </p>
          <p className="text-muted-foreground mt-2">
            Minimalny wiek do korzystania z&nbsp;Aplikacji wynosi <strong>16 lat</strong> (zgodnie z&nbsp;art. 8 RODO oraz polską ustawą o&nbsp;ochronie danych osobowych). Osoby poniżej 16 roku życia nie mogą korzystać z&nbsp;Aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            Operator ma prawo zawiesić lub usunąć konto użytkownika w&nbsp;przypadku naruszenia niniejszego regulaminu, przepisów prawa lub działań mogących zagrażać bezpieczeństwu Aplikacji lub innych użytkowników.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Zakres usług</h2>
          <p className="text-muted-foreground">Aplikacja umożliwia:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>przeglądanie tras po mieście udostępnionych przez innych użytkowników,</li>
            <li>przeglądanie pojedynczych miejsc (kawiarnie, restauracje, bary, miejsca kultury i&nbsp;natury),</li>
            <li>tworzenie własnych tras z&nbsp;wybranych miejsc oraz ich udostępnianie,</li>
            <li>zapisywanie ulubionych tras i&nbsp;miejsc,</li>
            <li>dodawanie zdjęć i&nbsp;notatek do miejsc oraz tras,</li>
            <li>wspólne tworzenie tras z&nbsp;innymi użytkownikami (tryb grupowy).</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Aplikacja jest dostępna bezpłatnie w&nbsp;wersji beta. Operator zastrzega prawo do zmiany zakresu usług, w&nbsp;tym wprowadzenia funkcji płatnych.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Treści użytkownika (zdjęcia, notatki, trasy)</h2>
          <p className="text-muted-foreground">
            „Treści użytkownika" to wszelkie materiały dodawane do Aplikacji przez użytkownika: zdjęcia, notatki, opisy, nazwy i&nbsp;układ tras oraz inne udostępniane materiały.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Prawa do treści.</strong> Użytkownik zachowuje wszelkie prawa do dodanych treści. Dodając treści, użytkownik oświadcza, że posiada do nich prawa (jest ich autorem lub ma zgodę uprawnionych) i&nbsp;że ich publikacja nie narusza praw osób trzecich.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Licencja dla Aplikacji.</strong> Dodając treści, użytkownik udziela Operatorowi niewyłącznej, nieodpłatnej, obowiązującej na całym świecie licencji na przechowywanie, zwielokrotnianie, wyświetlanie i&nbsp;udostępnianie tych treści w&nbsp;ramach Aplikacji, w&nbsp;zakresie niezbędnym do świadczenia usług. Licencja obejmuje w&nbsp;szczególności publiczne wyświetlanie treści innym użytkownikom, gdy użytkownik udostępnia trasę lub dodaje treści widoczne w&nbsp;eksploracji. Licencja wygasa po usunięciu treści przez użytkownika, z&nbsp;wyjątkiem kopii już udostępnionych innym użytkownikom lub przechowywanych w&nbsp;kopiach zapasowych przez czas niezbędny technicznie.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Widoczność.</strong> Trasy oraz zdjęcia dodane do miejsc mogą być <strong>publiczne</strong> i&nbsp;widoczne dla innych użytkowników w&nbsp;Aplikacji (m.in. w&nbsp;eksploracji tras oraz jako zdjęcia miejsc). Użytkownik powinien dodawać wyłącznie treści, które godzi się upublicznić.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Zdjęcia i&nbsp;wizerunek.</strong> Publikując zdjęcie, użytkownik zapewnia, że ma do niego prawa oraz że nie narusza prawa do wizerunku ani prywatności osób na nim widocznych. Nie wolno publikować zdjęć osób bez wymaganej zgody, ani zdjęć chronionych prawem autorskim osób trzecich bez uprawnienia.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Treści zakazane.</strong> Zabronione jest dodawanie treści: niezgodnych z&nbsp;prawem, naruszających prawa lub dobra osób trzecich (w&nbsp;tym prawa autorskie i&nbsp;dobra osobiste), obraźliwych, wulgarnych, zawierających mowę nienawiści, treści o&nbsp;charakterze pornograficznym lub drastycznym, danych osobowych innych osób bez ich zgody, spamu oraz treści wprowadzających w&nbsp;błąd.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Moderacja i&nbsp;zgłaszanie treści</h2>
          <p className="text-muted-foreground">
            Operator ma prawo usunąć treści naruszające regulamin lub przepisy prawa, a&nbsp;w&nbsp;uzasadnionych przypadkach ograniczyć lub zablokować konto, bez uprzedniego powiadomienia.
          </p>
          <p className="text-muted-foreground mt-2">
            Każdy użytkownik może zgłosić treść (np. zdjęcie lub wizytówkę), która jego zdaniem narusza regulamin, korzystając z&nbsp;opcji zgłoszenia dostępnej w&nbsp;Aplikacji lub pisząc na adres kontaktowy. Zgłoszenia rozpatrujemy bez zbędnej zwłoki.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Konta biznesowe (wizytówki lokali)</h2>
          <p className="text-muted-foreground">
            Właściciele lokali mogą utworzyć wizytówkę swojego miejsca i&nbsp;zarządzać jej treścią (opis, zdjęcia, aktualności). Zakładając wizytówkę, oświadczają, że są uprawnieni do reprezentowania danego lokalu oraz do publikacji dodawanych materiałów.
          </p>
          <p className="text-muted-foreground mt-2">
            Do treści dodawanych w&nbsp;ramach wizytówki stosuje się odpowiednio postanowienia dotyczące treści użytkownika (pkt&nbsp;4 i&nbsp;5). Niektóre funkcje biznesowe mogą być odpłatne, na warunkach wskazanych w&nbsp;Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Analityka i&nbsp;dane o&nbsp;korzystaniu</h2>
          <p className="text-muted-foreground">
            Za zgodą użytkownika Aplikacja zbiera <strong>anonimowe dane analityczne</strong> o&nbsp;sposobie korzystania (np. które ekrany są odwiedzane), aby rozwijać i&nbsp;ulepszać usługę. Nie sprzedajemy tych danych. Zgodę można w&nbsp;każdej chwili zmienić w&nbsp;ustawieniach.
          </p>
          <p className="text-muted-foreground mt-2">
            Szczegóły dotyczące narzędzi analitycznych, zakresu danych oraz podstaw ich przetwarzania znajdują się w&nbsp;{" "}
            <Link to="/privacy" className="underline font-medium">Polityce Prywatności</Link>.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Odpowiedzialność</h2>
          <p className="text-muted-foreground">Aplikacja jest dostępna w&nbsp;fazie beta.</p>
          <p className="text-muted-foreground mt-2">
            Operator nie gwarantuje nieprzerwanego działania usługi.
          </p>
          <p className="text-muted-foreground mt-2">
            Informacje o&nbsp;miejscach (m.in. godziny otwarcia, ceny, adresy, dostępność) mogą pochodzić od użytkowników lub źródeł zewnętrznych i&nbsp;mieć charakter pomocniczy oraz zawierać błędy. Operator nie ponosi odpowiedzialności za decyzje podjęte na podstawie treści prezentowanych w&nbsp;Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Reklamacje</h2>
          <p className="text-muted-foreground">
            Użytkownik może zgłaszać reklamacje dotyczące działania Aplikacji na adres e-mail{" "}
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
          <p className="text-muted-foreground mt-2">
            Reklamacje będą rozpatrywane w&nbsp;terminie do 14 dni.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">10. Ochrona danych osobowych</h2>
          <p className="text-muted-foreground">
            Szczegółowe informacje o&nbsp;tym, jakie dane zbieramy, na jakiej podstawie i&nbsp;jak je chronimy, znajdziesz w&nbsp;naszej{" "}
            <Link to="/privacy" className="underline font-medium">Polityce Prywatności</Link>.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">11. Zmiany regulaminu</h2>
          <p className="text-muted-foreground">
            Operator zastrzega prawo do zmiany regulaminu.
          </p>
          <p className="text-muted-foreground mt-2">
            O&nbsp;istotnych zmianach użytkownicy zostaną poinformowani poprzez Aplikację lub e-mailem.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">12. Prawo właściwe</h2>
          <p className="text-muted-foreground">
            Regulamin podlega prawu polskiemu. Spory wynikłe z&nbsp;korzystania z&nbsp;Aplikacji rozstrzygane są przez sądy właściwe dla miejsca zamieszkania Operatora.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">13. Kontakt</h2>
          <p className="text-muted-foreground">
            W&nbsp;sprawach dotyczących regulaminu skontaktuj się z&nbsp;Operatorem pod adresem e-mail:{" "}
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Ostatnia aktualizacja: sierpień 2026
        </p>
      </div>
    </div>
  );
};

export default Terms;
