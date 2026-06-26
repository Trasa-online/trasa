import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { ArrowRight, BookOpen } from "lucide-react";
import JournalTab from "@/components/home/JournalTab";

const Journal = () => {
  const { user, isAnonymous } = useAuth();
  const { open } = useAuthDrawer();
  // Anon = traktuj jak gosc (zero zapisanych danych w UI). Dziennik wymaga
  // konta z mailem zeby trasy/pocztówki byly persystowane miedzy urzadzeniami.
  const isGuestView = !user || isAnonymous;

  // Guest: pelnoekranowy wycentrowany empty state, bez tytulu strony (TopBar tez ukryty na route /dziennik)
  if (isGuestView) {
    // Większy pb żeby empty state wygladał na realnie wycentrowany (bez tego
    // pb=5rem grupa landuje ~10-15% ponizej optycznego srodka - icon + tytul
    // sa lekkie, button na dole ciągnie wizualnie ku dolowi).
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-[20vh] text-center">
        <div className="h-20 w-20 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
          <BookOpen className="h-9 w-9 text-orange-600" />
        </div>
        <div className="space-y-2 max-w-[320px]">
          <p className="text-2xl font-display font-extrabold tracking-tight leading-tight">Twój dziennik podróży</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Załóż konto, żeby zapisywać trasy, dodawać zdjęcia i&nbsp;oceniać miejsca z&nbsp;każdej podróży.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
          <button
            onClick={() => open({ mode: "register", hint: "journal" })}
            className="w-full px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Załóż konto
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => open({ mode: "login", hint: "journal" })}
            className="w-full px-8 py-3.5 rounded-full bg-white border-2 border-orange-600 text-orange-600 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Zaloguj się
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <h1 className="text-xl font-display font-extrabold tracking-tight pt-2 pb-3">Dziennik podróży</h1>
      <div className="border-b border-border/40 -mx-4 mb-3" />

      <JournalTab userId={user.id} />
    </div>
  );
};

export default Journal;
