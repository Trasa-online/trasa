import { useMemo } from "react";
import { Users } from "lucide-react";

interface Pin {
  expectation_met?: "yes" | "average" | "no" | null;
  trip_role?: "must_see" | "nice_addition" | "skippable" | null;
  pros?: string[];
  cons?: string[];
  one_liner?: string;
  recommended_for?: string[];
  address?: string;
}

interface RouteReviewSummaryProps {
  pins: Pin[];
}

function countBy<T>(items: T[], key: (item: T) => string | undefined | null): Record<string, number> {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const k = key(item);
    if (k) counts[k] = (counts[k] || 0) + 1;
  });
  return counts;
}

function topN(counts: Record<string, number>, n: number): [string, number][] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

const RouteReviewSummary = ({ pins }: RouteReviewSummaryProps) => {
  const activePins = useMemo(() => pins.filter((p) => p.address), [pins]);

  const hasExpectation = activePins.some((p) => p.expectation_met);
  const hasTripRole = activePins.some((p) => p.trip_role);

  const expectationCounts = useMemo(() => {
    const yes = activePins.filter((p) => p.expectation_met === "yes").length;
    const avg = activePins.filter((p) => p.expectation_met === "average").length;
    const no = activePins.filter((p) => p.expectation_met === "no").length;
    return { yes, average: avg, no };
  }, [activePins]);

  const totalExpectations = expectationCounts.yes + expectationCounts.average + expectationCounts.no;

  const topPros = useMemo(() => {
    const allPros = activePins.flatMap((p) => p.pros || []);
    return topN(countBy(allPros.map((p) => ({ v: p })), (i) => i.v), 3);
  }, [activePins]);

  const roleCounts = useMemo(() => {
    const must = activePins.filter((p) => p.trip_role === "must_see").length;
    const nice = activePins.filter((p) => p.trip_role === "nice_addition").length;
    const skip = activePins.filter((p) => p.trip_role === "skippable").length;
    return { must_see: must, nice_addition: nice, skippable: skip };
  }, [activePins]);

  const topRecommended = useMemo(() => {
    const all = activePins.flatMap((p) => p.recommended_for || []);
    return topN(countBy(all.map((r) => ({ v: r })), (i) => i.v), 3);
  }, [activePins]);

  if (!hasExpectation && !hasTripRole) return null;

  return (
    <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Twoje wrażenia</h3>

      {/* 1. Expectations bar */}
      {totalExpectations > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Oczekiwania</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full overflow-hidden flex bg-muted">
              {expectationCounts.yes > 0 && (
                <div
                  className="bg-green-500 dark:bg-green-600 h-full transition-all"
                  style={{ width: `${(expectationCounts.yes / totalExpectations) * 100}%` }}
                />
              )}
              {expectationCounts.average > 0 && (
                <div
                  className="bg-amber-400 dark:bg-amber-500 h-full transition-all"
                  style={{ width: `${(expectationCounts.average / totalExpectations) * 100}%` }}
                />
              )}
              {expectationCounts.no > 0 && (
                <div
                  className="bg-red-500 dark:bg-red-600 h-full transition-all"
                  style={{ width: `${(expectationCounts.no / totalExpectations) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-medium flex-shrink-0">
              {expectationCounts.yes > 0 && <span>😊 {expectationCounts.yes}</span>}
              {expectationCounts.average > 0 && <span>😐 {expectationCounts.average}</span>}
              {expectationCounts.no > 0 && <span>😕 {expectationCounts.no}</span>}
            </div>
          </div>
        </div>
      )}

      {/* 2. Top pros */}
      {topPros.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Top plusy</p>
          <div className="flex flex-wrap gap-1.5">
            {topPros.map(([label, count]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
              >
                {label} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Role counts */}
      {(roleCounts.must_see > 0 || roleCounts.nice_addition > 0 || roleCounts.skippable > 0) && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Rola miejsc</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
            {roleCounts.must_see > 0 && (
              <span>⭐ {roleCounts.must_see} {roleCounts.must_see === 1 ? "obowiązkowy" : "obowiązkowych"}</span>
            )}
            {roleCounts.nice_addition > 0 && (
              <span>➕ {roleCounts.nice_addition} {roleCounts.nice_addition === 1 ? "fajny dodatek" : "fajnych dodatków"}</span>
            )}
            {roleCounts.skippable > 0 && (
              <span>🔁 {roleCounts.skippable} do pominięcia</span>
            )}
          </div>
        </div>
      )}

      {/* 4. Recommended for */}
      {topRecommended.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Dla kogo ta trasa</p>
          <div className="flex flex-wrap gap-1.5">
            {topRecommended.map(([label, count]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
              >
                <Users className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteReviewSummary;
