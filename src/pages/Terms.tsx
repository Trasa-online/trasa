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
            Aplikacja Trasa (dalej: „Aplikacja") jest narzędziem do planowania podróży i&nbsp;prowadzenia dziennika turystycznego.
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
            Aby korzystać z&nbsp;Aplikacji, wymagana jest rejestracja z&nbsp;podaniem adresu e-mail i&nbsp;hasła lub logowanie przez konto Apple lub Google.
          </p>
          <p className="text-muted-foreground mt-2">
            Użytkownik zobowiązuje się podać prawdziwe dane i&nbsp;chronić dostęp do swojego konta. Konto jest przeznaczone wyłącznie do użytku osobistego.
          </p>
          <p className="text-muted-foreground mt-2">
            Minimalny wiek do rejestracji wynosi <strong>16 lat</strong> (zgodnie z&nbsp;art. 8 RODO oraz polską ustawą o&nbsp;ochronie danych osobowych). Osoby poniżej 16 roku życia nie mogą korzystać z&nbsp;Aplikacji.
          </p>
          <p className="text-muted-foreground mt-2">
            Operator ma prawo zawiesić lub usunąć konto użytkownika w&nbsp;przypadku naruszenia niniejszego regulaminu, przepisów prawa lub działań mogących zagrażać bezpieczeństwu Aplikacji lub innych użytkowników.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Zakres usług</h2>
          <p className="text-muted-foreground">Aplikacja umożliwia:</p>
          <ul className="text-muted-foreground list-disc list-inside mt-1 space-y-1">
            <li>planowanie tras i&nbsp;wycieczek z&nbsp;dopasowaniem opartym na AI,</li>
            <li>prowadzenie dziennika podróży w&nbsp;formie zapisanych tras, recenzji odwiedzonych miejsc oraz udostępnionych przez siebie zdjęć,</li>
            <li>przeglądanie własnych zapisanych tras, recenzji oraz zdjęć,</li>
            <li>wspólne planowanie tras z&nbsp;innymi użytkownikami (tryb grupowy).</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Aplikacja jest dostępna bezpłatnie w&nbsp;wersji beta. Operator zastrzega prawo do zmiany zakresu usług.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Treści użytkownika</h2>
          <p className="text-muted-foreground">
            Użytkownik zachowuje prawa do treści, które dodaje do Aplikacji (zdjęcia, opisy, recenzje, posty).
          </p>
          <p className="text-muted-foreground mt-2">
            Użytkownik zobowiązuje się nie dodawać treści naruszających prawo lub prawa osób trzecich (w&nbsp;szczególności: prawa autorskie, dobra osobiste, treści obraźliwe, nielegalne, mowa nienawiści).
          </p>
          <p className="text-muted-foreground mt-2">
            Operator ma prawo usunąć treści naruszające regulamin bez powiadomienia.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Odpowiedzialność</h2>
          <p className="text-muted-foreground">Aplikacja jest dostępna w&nbsp;fazie beta.</p>
          <p className="text-muted-foreground mt-2">
            Operator nie gwarantuje nieprzerwanego działania usługi ani poprawności planów generowanych przez AI.
          </p>
          <p className="text-muted-foreground mt-2">
            Wyniki generowane przez AI mają charakter pomocniczy i&nbsp;mogą zawierać błędy. W&nbsp;szczególności dotyczy to godzin otwarcia lokali, cen, dostępności miejsc oraz tras.
          </p>
          <p className="text-muted-foreground mt-2">
            Operator nie ponosi odpowiedzialności za decyzje podjęte na podstawie sugestii Aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Reklamacje</h2>
          <p className="text-muted-foreground">
            Użytkownik może zgłaszać reklamacje dotyczące działania Aplikacji na adres e-mail{" "}
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
          <p className="text-muted-foreground mt-2">
            Reklamacje będą rozpatrywane w&nbsp;terminie do 14 dni.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Ochrona danych osobowych</h2>
          <p className="text-muted-foreground">
            Szczegółowe informacje o&nbsp;tym, jakie dane zbieramy, na jakiej podstawie i&nbsp;jak je chronimy, znajdziesz w&nbsp;naszej{" "}
            <Link to="/privacy" className="underline font-medium">Polityce Prywatności</Link>.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Zmiany regulaminu</h2>
          <p className="text-muted-foreground">
            Operator zastrzega prawo do zmiany regulaminu.
          </p>
          <p className="text-muted-foreground mt-2">
            O&nbsp;istotnych zmianach użytkownicy zostaną poinformowani poprzez Aplikację lub e-mailem.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Prawo właściwe</h2>
          <p className="text-muted-foreground">
            Regulamin podlega prawu polskiemu. Spory wynikłe z&nbsp;korzystania z&nbsp;Aplikacji rozstrzygane są przez sądy właściwe dla miejsca zamieszkania Operatora.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">10. Kontakt</h2>
          <p className="text-muted-foreground">
            W&nbsp;sprawach dotyczących regulaminu skontaktuj się z&nbsp;Operatorem pod adresem e-mail:{" "}
            <a href="mailto:trasa.app@gmail.com" className="underline">trasa.app@gmail.com</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Ostatnia aktualizacja: maj 2026
        </p>
      </div>
    </div>
  );
};

export default Terms;
