import { useAuth } from "@/hooks/useAuth";
import JournalTab from "@/components/home/JournalTab";

const Journal = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-2 max-w-lg mx-auto">
        <h1 className="text-xl font-black tracking-tight pt-3 pb-3">Dziennik podróży</h1>
        <JournalTab userId={user.id} />
      </div>
    </div>
  );
};

export default Journal;
