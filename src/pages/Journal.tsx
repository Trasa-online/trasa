import { useAuth } from "@/hooks/useAuth";
import JournalTab from "@/components/home/JournalTab";

const Journal = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <h1 className="text-xl font-black tracking-tight pt-2 pb-3">Dziennik podróży</h1>
      <JournalTab userId={user.id} />
    </div>
  );
};

export default Journal;
