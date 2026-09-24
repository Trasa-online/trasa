import { useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { ArrowLeft } from "lucide-react";
import { BrandShield } from "@/components/BrandIcon";
import { scrollDocumentToTop } from "@/lib/scrollTop";

// REGULAMIN. Przeglad i rebranding 2026-09-24 (prosba Nat): wszedzie „spontaway", kontakt na
// hello@spontaway.com (adres, z ktorego realnie wychodza i na ktory wracaja maile z apki),
// opis uslugi zgodny z produktem (plany, kolekcje, znajomi, wizytowki lokali, kody QR).
//
// ⚠️ Dokument otwiera sie ZAWSZE od poczatku - patrz `scrollDocumentToTop`. Regulamin
// i Polityka linkuja do siebie nawzajem, a React Router nie zeruje pozycji przewijania.
const Terms = () => {
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
        <h1 className="text-base font-bold">Regulamin</h1>
      </header>

      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6 text-sm leading-relaxed">

        <Link
          to="/privacy"
          className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors"
        >
          <BrandShield className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Polityka Prywatności</p>
            <p className="text-xs text-muted-foreground">Jakie dane zbieramy i&nbsp;jak je chronimy</p>
          </div>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>

        <section>
          <h2 className="font-bold text-base mb-2">1. Postanowienia ogólne</h2>
          <p className="text-muted-foreground">
            <strong>spontaway</strong> (dalej: „Aplikacja") to aplikacja do planowania podróży i&nbsp;odkrywania miejsc. Użytkownicy przeglądają miejsca oraz plany i&nbsp;kolekcje udostępnione przez innych, tworzą własne plany podróży - samodzielnie lub wspólnie ze znajomymi - zbierają miejsca w&nbsp;kolekcjach i&nbsp;zapisują wspomnienia z&nbsp;wyjazdów.
          </p>
          <p className="text-muted-foreground mt-2">
            Operatorem Aplikacji jest Bartosz Tomala, e-mail:{" "}
            <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a> (dalej: „Operator").
          </p>
          <p className="text-muted-foreground mt-2">
            Korzystanie z&nbsp;Aplikacji oznacza akceptację niniejszego regulaminu.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Rejestracja i&nbsp;konto</h2>
          <p className="text-muted-foreground">
            Korzystanie z&nbsp;Aplikacji wymaga zalogowania się przez konto <strong>Apple</strong> lub <strong>Google</strong>. Konta lokali (wizytówki) zakładane są osobno, przez adres e-mail.
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
            <li>przeglądanie miejsc (kawiarnie, restauracje, bary, miejsca kultury i&nbsp;natury) oraz wizytówek lokali,</li>
            <li>tworzenie planów podróży - samodzielnie albo wspólnie z&nbsp;zaproszonymi osobami,</li>
            <li>zbieranie miejsc w&nbsp;kolekcjach, także wspólnych,</li>
            <li>dodawanie zdjęć, notatek i&nbsp;wyróżnień do miejsc, planów i&nbsp;kolekcji,</li>
            <li>publikowanie planów jako wspomnień i&nbsp;udostępnianie ich linkiem,</li>
            <li>obserwowanie innych użytkowników, zapraszanie do grona znajomych i&nbsp;czat w&nbsp;ramach wspólnego planu,</li>
            <li>zapisywanie cudzych planów i&nbsp;kolekcji,</li>
            <li>otrzymywanie powiadomień (w&nbsp;Aplikacji oraz - za zgodą - powiadomień push).</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Aplikacja jest dostępna bezpłatnie w&nbsp;wersji beta (testy przedpremierowe). Operator zastrzega prawo do zmiany zakresu usług, w&nbsp;tym wprowadzenia funkcji płatnych.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Treści użytkownika (zdjęcia, notatki, plany, kolekcje)</h2>
          <p className="text-muted-foreground">
            „Treści użytkownika" to wszelkie materiały dodawane do Aplikacji przez użytkownika: zdjęcia, notatki, opisy, nazwy i&nbsp;układ planów oraz kolekcji, a&nbsp;także inne udostępniane materiały.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Prawa do treści.</strong> Użytkownik zachowuje wszelkie prawa do dodanych treści. Dodając treści, użytkownik oświadcza, że posiada do nich prawa (jest ich autorem lub ma zgodę uprawnionych) i&nbsp;że ich publikacja nie narusza praw osób trzecich.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Licencja dla Aplikacji.</strong> Dodając treści, użytkownik udziela Operatorowi niewyłącznej, nieodpłatnej, obowiązującej na całym świecie licencji na przechowywanie, zwielokrotnianie, wyświetlanie i&nbsp;udostępnianie tych treści w&nbsp;ramach Aplikacji, w&nbsp;zakresie niezbędnym do świadczenia usług. Licencja obejmuje w&nbsp;szczególności publiczne wyświetlanie treści innym użytkownikom, gdy użytkownik publikuje plan, udostępnia go linkiem albo prowadzi publiczną kolekcję. Licencja wygasa po usunięciu treści przez użytkownika, z&nbsp;wyjątkiem kopii już udostępnionych innym użytkownikom lub przechowywanych w&nbsp;kopiach zapasowych przez czas niezbędny technicznie.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Widoczność.</strong> Plan roboczy i&nbsp;kolekcja oznaczona jako prywatna są widoczne wyłącznie dla Ciebie i&nbsp;osób, które do nich zaprosisz. Opublikowany plan, publiczna kolekcja oraz zdjęcia dodane do miejsc mogą być <strong>widoczne dla wszystkich</strong> użytkowników Aplikacji, a&nbsp;udostępniony link otwiera się także poza Aplikacją, w&nbsp;przeglądarce. Zdjęcie w&nbsp;planie można oznaczyć jako widoczne <strong>tylko dla znajomych</strong>. Użytkownik powinien publikować wyłącznie treści, które godzi się upublicznić.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Notatki o&nbsp;miejscach.</strong> Notatka napisana o&nbsp;danym miejscu jest <strong>jedną notatką tego użytkownika o&nbsp;tym miejscu</strong> - pojawia się wszędzie tam, gdzie użytkownik ma to miejsce (w&nbsp;planach i&nbsp;kolekcjach), również wtedy, gdy któraś z&nbsp;tych treści jest publiczna, a&nbsp;także na wizytówce miejsca w&nbsp;sekcji „Od użytkowników". Notatkę można w&nbsp;każdej chwili zmienić lub usunąć - zmiana obejmuje wtedy wszystkie te miejsca naraz.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Zdjęcia przypisane do miejsc.</strong> Dodając zdjęcie przypisane do konkretnego miejsca, użytkownik wyraża zgodę na jego wykorzystanie do <strong>ilustrowania tego miejsca w&nbsp;Aplikacji</strong> - w&nbsp;szczególności na kartach miejsc, w&nbsp;eksploracji oraz na <strong>wizytówce danego lokalu</strong> (również gdy lokal posiada konto biznesowe). Zdjęcie może być prezentowane innym użytkownikom jako zdjęcie tego miejsca, niezależnie od planu, w&nbsp;ramach którego zostało dodane. Zgoda ta pozostaje w&nbsp;mocy dopóki zdjęcie nie zostanie usunięte przez użytkownika, z&nbsp;zastrzeżeniem kopii technicznych i&nbsp;już udostępnionych zgodnie z&nbsp;niniejszym punktem.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Zdjęcia i&nbsp;wizerunek.</strong> Publikując zdjęcie, użytkownik zapewnia, że ma do niego prawa oraz że nie narusza prawa do wizerunku ani prywatności osób na nim widocznych. Nie wolno publikować zdjęć osób bez wymaganej zgody ani zdjęć chronionych prawem autorskim osób trzecich bez uprawnienia.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Treści zakazane.</strong> Zabronione jest dodawanie treści: niezgodnych z&nbsp;prawem, naruszających prawa lub dobra osób trzecich (w&nbsp;tym prawa autorskie i&nbsp;dobra osobiste), obraźliwych, wulgarnych, zawierających mowę nienawiści, treści o&nbsp;charakterze pornograficznym lub drastycznym, danych osobowych innych osób bez ich zgody, spamu oraz treści wprowadzających w&nbsp;błąd.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Automatyczne sprawdzanie zdjęć.</strong> Zdjęcia dodawane do Aplikacji przechodzą automatyczne sprawdzenie pod kątem treści nieodpowiednich (m.in. pornograficznych i&nbsp;drastycznych). Zdjęcie ocenione jako niedozwolone może zostać usunięte lub zatrzymane do przeglądu. Od decyzji można odwołać się, pisząc na adres kontaktowy.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Moderacja, zgłoszenia i&nbsp;blokowanie</h2>
          <p className="text-muted-foreground">
            Operator ma prawo usunąć treści naruszające regulamin lub przepisy prawa, a&nbsp;w&nbsp;uzasadnionych przypadkach ograniczyć lub zablokować konto, bez uprzedniego powiadomienia.
          </p>
          <p className="text-muted-foreground mt-2">
            Każdy użytkownik może zgłosić treść (np. zdjęcie, notatkę, plan, kolekcję albo wizytówkę) lub profil, który jego zdaniem narusza regulamin, korzystając z&nbsp;opcji zgłoszenia dostępnej w&nbsp;Aplikacji albo pisząc na adres kontaktowy. Zgłoszenia rozpatrujemy bez zbędnej zwłoki.
          </p>
          <p className="text-muted-foreground mt-2">
            Użytkownik może samodzielnie <strong>zablokować</strong> inną osobę - jej treści przestają być dla niego widoczne, a&nbsp;ona traci dostęp do jego profilu. Listę zablokowanych osób znajdziesz w&nbsp;Ustawieniach.
          </p>
          <p className="text-muted-foreground mt-2">
            Usunięte plany i&nbsp;kolekcje trafiają do <strong>Kosza</strong> i&nbsp;można je przywrócić przez <strong>7 dni</strong>; po tym czasie są kasowane bezpowrotnie.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Konta lokali (wizytówki)</h2>
          <p className="text-muted-foreground">
            Właściciele lokali mogą utworzyć wizytówkę swojego miejsca i&nbsp;zarządzać jej treścią (opis, zdjęcia, aktualności, dane kontaktowe). Zakładając wizytówkę, oświadczają, że są uprawnieni do reprezentowania danego lokalu oraz do publikacji dodawanych materiałów. Wizytówka jest weryfikowana przed publikacją.
          </p>
          <p className="text-muted-foreground mt-2">
            Lokal może otrzymać <strong>kod QR</strong> do umieszczenia w&nbsp;swoim wnętrzu. Zeskanowanie kodu otwiera stronę miejsca, a&nbsp;zalogowanemu użytkownikowi pozwala oznaczyć je jako odwiedzone.
          </p>
          <p className="text-muted-foreground mt-2">
            Do treści dodawanych w&nbsp;ramach wizytówki stosuje się odpowiednio postanowienia dotyczące treści użytkownika (pkt&nbsp;4 i&nbsp;5). Zdjęcia i&nbsp;notatki dodane przez użytkowników pozostają ich treściami - lokal może je zgłosić do moderacji, ale nie usuwa ich samodzielnie. Niektóre funkcje biznesowe mogą być odpłatne, na warunkach wskazanych w&nbsp;Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Analityka i&nbsp;dane o&nbsp;korzystaniu</h2>
          <p className="text-muted-foreground">
            Za zgodą użytkownika Aplikacja zbiera <strong>dane analityczne</strong> o&nbsp;sposobie korzystania (np. które ekrany są odwiedzane), aby rozwijać i&nbsp;ulepszać usługę. Zgodę można w&nbsp;każdej chwili zmienić w&nbsp;Ustawieniach.
          </p>
          <p className="text-muted-foreground mt-2">
            Niezależnie od zgody zbieramy techniczne informacje o&nbsp;błędach Aplikacji - bez nich nie da się jej naprawiać.
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
            Informacje o&nbsp;miejscach (m.in. godziny otwarcia, ceny, adresy, dostępność) mogą pochodzić od użytkowników, od lokali lub ze źródeł zewnętrznych (m.in. Google Maps) i&nbsp;mieć charakter pomocniczy oraz zawierać błędy. Operator nie ponosi odpowiedzialności za decyzje podjęte na podstawie treści prezentowanych w&nbsp;Aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            Za treści dodane przez użytkowników odpowiadają ich autorzy. Operator nie prowadzi uprzedniej kontroli wszystkich treści, ale reaguje na zgłoszenia zgodnie z&nbsp;pkt&nbsp;5.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Reklamacje</h2>
          <p className="text-muted-foreground">
            Użytkownik może zgłaszać reklamacje dotyczące działania Aplikacji na adres e-mail{" "}
            <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
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
            Operator zastrzega prawo do zmiany regulaminu, w&nbsp;szczególności w&nbsp;razie zmiany zakresu usług, przepisów prawa lub formy prawnej Operatora.
          </p>
          <p className="text-muted-foreground mt-2">
            O&nbsp;istotnych zmianach użytkownicy zostaną poinformowani poprzez Aplikację lub e-mailem, z&nbsp;wyprzedzeniem pozwalającym na zapoznanie się z&nbsp;nowym brzmieniem. Dalsze korzystanie z&nbsp;Aplikacji po wejściu zmian w&nbsp;życie oznacza ich akceptację.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">12. Prawo właściwe i&nbsp;spory</h2>
          <p className="text-muted-foreground">
            Regulamin podlega prawu polskiemu. Wybór prawa polskiego nie pozbawia konsumenta ochrony wynikającej z&nbsp;bezwzględnie obowiązujących przepisów prawa państwa jego zwykłego pobytu.
          </p>
          <p className="text-muted-foreground mt-2">
            Spory rozstrzyga sąd właściwy według przepisów prawa. Konsument może też skorzystać z&nbsp;pozasądowych sposobów rozpatrywania reklamacji i&nbsp;dochodzenia roszczeń, m.in. za pośrednictwem wojewódzkich inspektoratów Inspekcji Handlowej oraz miejskich i&nbsp;powiatowych rzeczników konsumentów. Informacje o&nbsp;tych możliwościach są dostępne na stronie{" "}
            <a href="https://uokik.gov.pl" target="_blank" rel="noreferrer" className="underline">uokik.gov.pl</a>.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">13. Kontakt</h2>
          <p className="text-muted-foreground">
            W&nbsp;sprawach dotyczących regulaminu skontaktuj się z&nbsp;Operatorem pod adresem e-mail:{" "}
            <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Ostatnia aktualizacja: 24 września 2026
        </p>
      </div>
    </div>
  );
};

export default Terms;
