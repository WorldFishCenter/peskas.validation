import { EnumeratorData, EnumeratorDailyStat } from '../types';

/** Sum the counts of a set of rollup rows. */
export const sumCounts = (stats: EnumeratorDailyStat[]): number =>
  stats.reduce((total, stat) => total + stat.count, 0);

/** Sum the counts of the rollup rows that carry an alert code. */
export const sumAlertCounts = (stats: EnumeratorDailyStat[]): number =>
  stats.reduce((total, stat) => (stat.alert_flag ? total + stat.count : total), 0);

/**
 * Collapse rollup rows to a sorted date → count series.
 *
 * Several rows can share a day — one per alert code — so they are summed rather than listed.
 * Rows whose date could not be parsed carry no day and are dropped from the trend, exactly as
 * they were when the endpoint returned raw submissions.
 */
export const toTrend = (stats: EnumeratorDailyStat[]): { date: string; count: number }[] => {
  const byDate: Record<string, number> = {};
  for (const stat of stats) {
    if (!stat.date) continue;
    byDate[stat.date] = (byDate[stat.date] || 0) + stat.count;
  }
  return Object.entries(byDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Group the `/enumerators-stats` rollup by enumerator.
 *
 * The endpoint already excludes placeholder enumerators and folds the three spellings of "no
 * alert" into an absent field, so there is nothing left to clean here — this is a group-by and
 * three sums.
 */
export const processEnumeratorData = (rollup: EnumeratorDailyStat[]): EnumeratorData[] => {
  if (!rollup || rollup.length === 0) return [];

  const byEnumerator: Record<string, EnumeratorDailyStat[]> = {};
  for (const stat of rollup) {
    if (!stat.submitted_by) continue;
    (byEnumerator[stat.submitted_by] ||= []).push(stat);
  }

  return Object.entries(byEnumerator)
    .map(([name, dailyStats]): EnumeratorData => {
      const totalSubmissions = sumCounts(dailyStats);
      const submissionsWithAlerts = sumAlertCounts(dailyStats);
      return {
        name,
        dailyStats,
        totalSubmissions,
        submissionsWithAlerts,
        errorRate: totalSubmissions > 0 ? (submissionsWithAlerts / totalSubmissions) * 100 : 0,
        submissionTrend: toTrend(dailyStats)
      };
    })
    .sort((a, b) => b.totalSubmissions - a.totalSubmissions);
};

/**
 * Quality score for an enumerator: 100 minus their error rate.
 *
 * Prefers `filteredErrorRate`, which is set whenever a date filter is active, and falls back
 * to the all-time rate otherwise. Every quality figure in the UI comes from here so the
 * filtered/unfiltered fallback cannot be applied inconsistently.
 */
export const qualityScore = (
  enumerator: Pick<EnumeratorData, 'errorRate' | 'filteredErrorRate'> | undefined
): number => 100 - (enumerator?.filteredErrorRate ?? enumerator?.errorRate ?? 0);

/**
 * Tally alert flags across one or more enumerators, most frequent first.
 *
 * Shared by the aggregate alert chart and the single-enumerator one — the former passes the
 * whole list, the latter an array of one. "NA" is the pipeline's marker for no alert.
 */
export const tallyAlertFlags = (
  enumerators: EnumeratorData[]
): { name: string; y: number }[] => {
  const counts: Record<string, number> = {};

  enumerators.forEach(enumerator => {
    (enumerator.filteredStats || enumerator.dailyStats).forEach(stat => {
      if (stat.alert_flag) {
        counts[stat.alert_flag] = (counts[stat.alert_flag] || 0) + stat.count;
      }
    });
  });

  return Object.entries(counts)
    .map(([name, y]) => ({ name, y }))
    .sort((a, b) => b.y - a.y);
};


/**
 * Submissions to show for an enumerator: the date-filtered count when a filter is active,
 * otherwise the all-time count.
 *
 * This one rule was previously written three ways across six modules — `??`, `||`, and
 * `!== undefined ? :` — which are *not* equivalent. The eight `||` sites treated a filtered
 * total of 0 as "no filtered value" and fell back to the all-time total, so an enumerator with
 * no submissions in the selected range was shown their lifetime count on a filtered screen.
 */
export const displayTotal = (e: Pick<EnumeratorData, 'filteredTotal' | 'totalSubmissions'>): number =>
  e.filteredTotal ?? e.totalSubmissions;

/** Alerts to show for an enumerator, under the same filtered/all-time rule as `displayTotal`. */
export const displayAlerts = (
  e: Pick<EnumeratorData, 'filteredAlertsCount' | 'submissionsWithAlerts'>
): number => e.filteredAlertsCount ?? e.submissionsWithAlerts;

/** Error rate to show for an enumerator, under the same rule. */
export const displayErrorRate = (
  e: Pick<EnumeratorData, 'filteredErrorRate' | 'errorRate'>
): number => e.filteredErrorRate ?? e.errorRate;

/**
 * Earliest and latest day present in the rollup.
 *
 * The rollup carries plain `YYYY-MM-DD` days, so these are string comparisons rather than Date
 * construction. Returns nulls for an empty rollup — the caller decides what to do with that,
 * rather than this function guessing at today's date.
 */
export const dateBounds = (
  enumerators: EnumeratorData[]
): { min: string | null; max: string | null } => {
  let min: string | null = null;
  let max: string | null = null;
  for (const enumerator of enumerators) {
    for (const stat of enumerator.dailyStats) {
      if (!stat.date) continue;
      if (min === null || stat.date < min) min = stat.date;
      if (max === null || stat.date > max) max = stat.date;
    }
  }
  return { min, max };
};

/**
 * Narrow every enumerator's rollup rows to a day range, recomputing their totals.
 *
 * An empty `from`/`to` means unbounded on that side. Every enumerator is kept, including those
 * with nothing in range — dropping them here would silently change who appears in the charts.
 */
export const applyDateRange = (
  enumerators: EnumeratorData[],
  fromDate: string,
  toDate: string
): EnumeratorData[] =>
  enumerators.map(enumerator => {
    const filteredStats = enumerator.dailyStats.filter(stat => {
      if (!stat.date) return false;
      return (!fromDate || stat.date >= fromDate) && (!toDate || stat.date <= toDate);
    });
    const filteredTotal = sumCounts(filteredStats);
    const filteredAlertsCount = sumAlertCounts(filteredStats);
    return {
      ...enumerator,
      filteredStats,
      filteredTrend: toTrend(filteredStats),
      filteredTotal,
      filteredAlertsCount,
      filteredErrorRate: filteredTotal > 0 ? (filteredAlertsCount / filteredTotal) * 100 : 0
    };
  });

/** Every day any enumerator has data for, ascending. `YYYY-MM-DD` sorts lexically. */
export const uniqueDates = (enumerators: EnumeratorData[]): string[] =>
  [...new Set(enumerators.flatMap(e => (e.filteredTrend || []).map(point => point.date)))].sort();

/** Enumerators with at least one submission in view, busiest first. */
export const byVolume = (enumerators: EnumeratorData[]): EnumeratorData[] =>
  enumerators.filter(e => displayTotal(e) > 0).sort((a, b) => displayTotal(b) - displayTotal(a));

/**
 * Enumerators with at least one submission in view, best quality first.
 *
 * The ranking rule lived in `QualityRankingChart` and was re-derived, differently, in three
 * other modules. Ties break on volume, matching `findBestEnumerator`.
 */
export const byQuality = (enumerators: EnumeratorData[]): EnumeratorData[] =>
  enumerators
    .filter(e => displayTotal(e) > 0)
    .sort((a, b) =>
      displayErrorRate(a) - displayErrorRate(b) || displayTotal(b) - displayTotal(a));

/** Totals across everyone currently in view. */
export const summarise = (
  enumerators: EnumeratorData[]
): { totalSubmissions: number; totalAlerts: number; avgErrorRate: number } => {
  const totalSubmissions = enumerators.reduce((sum, e) => sum + displayTotal(e), 0);
  const totalAlerts = enumerators.reduce((sum, e) => sum + displayAlerts(e), 0);
  return {
    totalSubmissions,
    totalAlerts,
    avgErrorRate: totalSubmissions > 0 ? (totalAlerts / totalSubmissions) * 100 : 0
  };
};

/**
 * One enumerator's volume as a percentage of the average, rounded.
 *
 * Was computed inline inside JSX, where it could not be tested and its divide-by-zero case was
 * invisible. Returns 0 when there is nobody to average over.
 */
export const shareOfAverage = (
  enumerator: Pick<EnumeratorData, 'filteredTotal' | 'totalSubmissions'>,
  enumerators: EnumeratorData[]
): number => {
  if (enumerators.length === 0) return 0;
  const mean = enumerators.reduce((sum, e) => sum + displayTotal(e), 0) / enumerators.length;
  return mean > 0 ? Math.round((displayTotal(enumerator) / mean) * 100) : 0;
};

/**
 * Find the best performing enumerator based on quality (lowest error rate)
 * Only considers enumerators with a minimum number of submissions for statistical significance
 *
 * @param enumerators - Array of enumerator data
 * @param minSubmissions - Minimum submissions required (default: 10)
 * @returns The best performing enumerator
 */
export const findBestEnumerator = (
  enumerators: EnumeratorData[],
  minSubmissions: number = 10
): EnumeratorData => {
  if (enumerators.length === 0) {
    return {
      name: '',
      errorRate: 0,
      filteredErrorRate: 0,
      dailyStats: [],
      totalSubmissions: 0,
      submissionsWithAlerts: 0,
      submissionTrend: []
    };
  }

  // Enough submissions to compare meaningfully; if nobody clears the bar, halve it. Both passes
  // rank by quality with volume as the tiebreaker, which is exactly `byQuality`.
  const lowerThreshold = Math.max(1, Math.floor(minSubmissions / 2));
  for (const threshold of [minSubmissions, lowerThreshold]) {
    const qualified = enumerators.filter(e => displayTotal(e) >= threshold);
    if (qualified.length > 0) {
      return byQuality(qualified)[0] ?? qualified[0];
    }
  }

  // Still nobody: fall back to whoever submitted most.
  return enumerators.reduce(
    (best, current) => (displayTotal(current) > displayTotal(best) ? current : best),
    enumerators[0]
  );
}; 