const TripFeedCardSkeleton = () => {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="aspect-[16/10] bg-muted animate-pulse" />
      <div className="px-4 pt-3">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="h-3 w-20 bg-muted animate-pulse rounded mt-1" />
      </div>
      <div className="px-4 pt-2 flex gap-2">
        <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
        <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
        <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
      </div>
      <div className="px-4 pt-2 pb-2">
        <div className="h-3 w-full bg-muted animate-pulse rounded mt-2" />
        <div className="h-3 w-full bg-muted animate-pulse rounded mt-2" />
        <div className="h-3 w-3/4 bg-muted animate-pulse rounded mt-2" />
      </div>
      <div className="px-4 py-3 border-t border-border/50 flex gap-4">
        <div className="h-4 w-12 bg-muted animate-pulse rounded" />
        <div className="h-4 w-12 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
};

export default TripFeedCardSkeleton;
