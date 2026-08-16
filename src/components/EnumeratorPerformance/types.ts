import { EnumeratorDailyStat } from '../../types/validation';

export type { EnumeratorDailyStat };

/**
 * One enumerator's performance, built from the `/enumerators-stats` rollup.
 *
 * The `filtered*` fields are the same figures recomputed for the selected date range. They are
 * optional because they only exist once a range has been applied; every reader falls back to the
 * all-time value.
 */
export interface EnumeratorData {
  name: string;
  /** The rollup rows belonging to this enumerator. */
  dailyStats: EnumeratorDailyStat[];
  totalSubmissions: number;
  submissionsWithAlerts: number;
  errorRate: number;
  submissionTrend: { date: string; count: number }[];
  filteredStats?: EnumeratorDailyStat[];
  filteredTrend?: { date: string; count: number }[];
  filteredTotal?: number;
  filteredAlertsCount?: number;
  filteredErrorRate?: number;
  survey_name?: string;
  survey_country?: string;
}

export type ChartTabType = 'volume' | 'trends' | 'quality' | 'errors';
export type DetailTabType = 'overview' | 'trends' | 'alerts';
