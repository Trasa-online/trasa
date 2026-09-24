import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandShield } from "@/components/BrandIcon";
import LegalShell from "@/pages/legal/LegalShell";

// REGULAMIN - PL i EN (prosba Nat 2026-09-24: „zdecydowanie zrob wersje ENG").
//
// ⚠️ Dokument idzie za jezykiem APLIKACJI (i18n), nie za osobnym przelacznikiem: user, ktory
// czyta apke po angielsku, ma dostac angielski regulamin z tego samego linku. Obie wersje
// leza w JEDNYM pliku, obok siebie - dokument prawny, ktorego dwie wersje mieszkaja osobno,
// rozjezdza sie przy pierwszej poprawce.
//
// Kontakt: `hello@spontaway.com` (sprawy ogolne i reklamacje), `admin@spontaway.com` (dane
// osobowe - patrz Polityka Prywatnosci).
//
// ⚠️ Operatorem jest Bartosz Tomala. Spolka powstaje ok. 1.10.2026 - po rejestracji trzeba
// podmienic operatora w OBU dokumentach i powiadomic userow (pkt „Zmiany regulaminu"),
// bo zmiana operatora to zmiana ADMINISTRATORA danych.

const Terms = () => {
  const { i18n } = useTranslation();
  const en = (i18n.language ?? "pl").toLowerCase().startsWith("en");
  return <LegalShell title={en ? "Terms of Service" : "Regulamin"}>{en ? <TermsEn /> : <TermsPl />}</LegalShell>;
};

const TermsPl = () => (
  <>
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
  </>
);

const TermsEn = () => (
  <>
    <Link
      to="/privacy"
      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors"
    >
      <BrandShield className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Privacy Policy</p>
        <p className="text-xs text-muted-foreground">What data we collect and how we protect it</p>
      </div>
      <span className="text-muted-foreground text-sm">→</span>
    </Link>

    <section>
      <h2 className="font-bold text-base mb-2">1. General provisions</h2>
      <p className="text-muted-foreground">
        <strong>spontaway</strong> (the „App") is an app for planning trips and discovering places. Users browse places as well as plans and collections shared by others, create their own trip plans - alone or together with friends - gather places in collections and keep memories from their trips.
      </p>
      <p className="text-muted-foreground mt-2">
        The App is operated by Bartosz Tomala, e-mail:{" "}
        <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a> (the „Operator").
      </p>
      <p className="text-muted-foreground mt-2">
        Using the App means you accept these Terms.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">2. Registration and account</h2>
      <p className="text-muted-foreground">
        Using the App requires signing in with an <strong>Apple</strong> or <strong>Google</strong> account. Venue accounts (business listings) are created separately, with an e-mail address.
      </p>
      <p className="text-muted-foreground mt-2">
        You agree to provide true information and to protect access to your account. The account is for personal use.
      </p>
      <p className="text-muted-foreground mt-2">
        The minimum age to use the App is <strong>16</strong> (in line with Art. 8 GDPR and Polish data protection law). People under 16 may not use the App.
      </p>
      <p className="text-muted-foreground mt-2">
        The Operator may suspend or delete an account if these Terms or the law are breached, or in case of activity that may endanger the App or other users.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">3. What the App offers</h2>
      <p className="text-muted-foreground">The App lets you:</p>
      <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
        <li>browse places (cafés, restaurants, bars, culture and nature spots) and venue listings,</li>
        <li>create trip plans - on your own or together with people you invite,</li>
        <li>gather places in collections, including shared ones,</li>
        <li>add photos, notes and highlights to places, plans and collections,</li>
        <li>publish plans as memories and share them with a link,</li>
        <li>follow other users, send friend requests and chat inside a shared plan,</li>
        <li>save other people's plans and collections,</li>
        <li>receive notifications (in the App and, with your consent, push notifications).</li>
      </ul>
      <p className="text-muted-foreground mt-2">
        The App is free of charge in its beta (pre-release) version. The Operator may change the scope of the service, including introducing paid features.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">4. User content (photos, notes, plans, collections)</h2>
      <p className="text-muted-foreground">
        „User content" means anything you add to the App: photos, notes, descriptions, names and the order of plans and collections, and any other material you share.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Your rights.</strong> You keep all rights to the content you add. By adding content you declare that you hold the rights to it (you are its author or have permission) and that publishing it does not infringe anyone else's rights.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Licence to the App.</strong> By adding content you grant the Operator a non-exclusive, royalty-free, worldwide licence to store, reproduce, display and share that content within the App, to the extent necessary to provide the service. The licence covers in particular showing content publicly to other users when you publish a plan, share it with a link or keep a public collection. The licence ends when you delete the content, except for copies already shared with other users or kept in backups for as long as technically necessary.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Visibility.</strong> A draft plan and a collection marked as private are visible only to you and the people you invite. A published plan, a public collection and photos added to places may be <strong>visible to everyone</strong> using the App, and a shared link also opens outside the App, in a browser. A photo in a plan can be marked as visible <strong>to friends only</strong>. Publish only content you are willing to make public.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Notes about places.</strong> A note you write about a place is <strong>one note of yours about that place</strong> - it appears everywhere you have that place (in plans and collections), including where that content is public, and on the place listing under „From users". You can change or delete the note at any time - the change then applies in all those spots at once.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Photos attached to places.</strong> By adding a photo attached to a specific place you agree that it may be used to <strong>illustrate that place in the App</strong> - in particular on place cards, in exploration and on the <strong>listing of that venue</strong> (also when the venue has a business account). The photo may be shown to other users as a photo of that place, regardless of the plan it was added to. This permission lasts until you delete the photo, subject to technical copies and copies already shared as described in this section.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Photos and likeness.</strong> When publishing a photo you confirm that you hold the rights to it and that it does not infringe the image rights or privacy of people visible in it. Do not publish photos of people without the required consent, or third-party copyrighted photos without permission.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Prohibited content.</strong> Do not add content that is unlawful, infringes the rights of others (including copyright and personal rights), is offensive, vulgar, contains hate speech, pornographic or graphic material, other people's personal data without their consent, spam, or misleading content.
      </p>
      <p className="text-muted-foreground mt-2">
        <strong>Automated photo screening.</strong> Photos added to the App are screened automatically for inappropriate content (including pornographic and graphic material). A photo assessed as not allowed may be removed or held for review. You can appeal by writing to our contact address.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">5. Moderation, reports and blocking</h2>
      <p className="text-muted-foreground">
        The Operator may remove content that breaches these Terms or the law and, in justified cases, restrict or block an account without prior notice.
      </p>
      <p className="text-muted-foreground mt-2">
        Any user can report content (for example a photo, a note, a plan, a collection or a venue listing) or a profile they believe breaches these Terms, using the report option in the App or by writing to our contact address. We handle reports without undue delay.
      </p>
      <p className="text-muted-foreground mt-2">
        You can <strong>block</strong> another person yourself - their content stops being visible to you and they lose access to your profile. The list of blocked people is in Settings.
      </p>
      <p className="text-muted-foreground mt-2">
        Plans and collections you delete go to the <strong>Trash</strong> and can be restored for <strong>7 days</strong>; after that they are deleted permanently.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">6. Venue accounts (business listings)</h2>
      <p className="text-muted-foreground">
        Venue owners can create a listing for their place and manage its content (description, photos, updates, contact details). By creating a listing they declare that they are authorised to represent the venue and to publish the material they add. Listings are verified before publication.
      </p>
      <p className="text-muted-foreground mt-2">
        A venue may receive a <strong>QR code</strong> to display on the premises. Scanning it opens the place page and lets a signed-in user mark the place as visited.
      </p>
      <p className="text-muted-foreground mt-2">
        Content added through a listing is subject to the rules on user content (sections 4 and 5). Photos and notes added by users remain their content - a venue can report them for moderation but cannot delete them. Some business features may be paid, on the terms stated in the App.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">7. Analytics and usage data</h2>
      <p className="text-muted-foreground">
        With your consent, the App collects <strong>analytics data</strong> about how it is used (for example which screens are visited) in order to develop and improve the service. You can change your consent at any time in Settings.
      </p>
      <p className="text-muted-foreground mt-2">
        Regardless of consent, we collect technical information about App errors - without it the App cannot be fixed.
      </p>
      <p className="text-muted-foreground mt-2">
        Details about the analytics tools, the scope of data and the legal bases are in our{" "}
        <Link to="/privacy" className="underline font-medium">Privacy Policy</Link>.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">8. Liability</h2>
      <p className="text-muted-foreground">The App is available in a beta version.</p>
      <p className="text-muted-foreground mt-2">
        The Operator does not guarantee uninterrupted availability of the service.
      </p>
      <p className="text-muted-foreground mt-2">
        Information about places (opening hours, prices, addresses, availability and similar) may come from users, from venues or from external sources (including Google Maps); it is auxiliary and may contain errors. The Operator is not liable for decisions made on the basis of content presented in the App.
      </p>
      <p className="text-muted-foreground mt-2">
        Users are responsible for the content they add. The Operator does not pre-screen all content but responds to reports as described in section 5.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">9. Complaints</h2>
      <p className="text-muted-foreground">
        You can send complaints about how the App works to{" "}
        <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
      </p>
      <p className="text-muted-foreground mt-2">
        Complaints are handled within 14 days.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">10. Personal data</h2>
      <p className="text-muted-foreground">
        Detailed information about what data we collect, on what basis and how we protect it is in our{" "}
        <Link to="/privacy" className="underline font-medium">Privacy Policy</Link>.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">11. Changes to the Terms</h2>
      <p className="text-muted-foreground">
        The Operator may change these Terms, in particular when the scope of the service, the law or the Operator's legal form changes.
      </p>
      <p className="text-muted-foreground mt-2">
        We will inform users about significant changes in the App or by e-mail, with enough notice to read the new version. Continuing to use the App after the changes take effect means you accept them.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">12. Governing law and disputes</h2>
      <p className="text-muted-foreground">
        These Terms are governed by Polish law. Choosing Polish law does not deprive a consumer of the protection of mandatory provisions of the law of their country of habitual residence.
      </p>
      <p className="text-muted-foreground mt-2">
        Disputes are settled by the court having jurisdiction under applicable law. Consumers may also use out-of-court complaint and redress procedures, including those offered by the Polish Trade Inspection and by municipal and district consumer ombudsmen. Information is available at{" "}
        <a href="https://uokik.gov.pl" target="_blank" rel="noreferrer" className="underline">uokik.gov.pl</a>.
      </p>
    </section>

    <section>
      <h2 className="font-bold text-base mb-2">13. Contact</h2>
      <p className="text-muted-foreground">
        For questions about these Terms, contact the Operator at{" "}
        <a href="mailto:hello@spontaway.com" className="underline">hello@spontaway.com</a>.
      </p>
    </section>

    <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
      Last updated: 24 September 2026
    </p>
  </>
);

export default Terms;
