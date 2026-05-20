import DiscoveryFeed from "@/components/home/DiscoveryFeed";

const Explore = () => {
  return (
    <div className="flex-1 flex flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <div className="mb-3">
        <h1 className="text-xl font-black tracking-tight pt-2">Eksploruj</h1>
        <p className="text-xs text-muted-foreground mt-1">Polecane miejsca, trasy i pomysły od społeczności.</p>
      </div>
      <DiscoveryFeed />
    </div>
  );
};

export default Explore;
