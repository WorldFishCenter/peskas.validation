export interface SubmissionData {
  submission_id: string;
  submitted_by: string;
  submission_date: string;
  alert_flag: string | null;
}

export interface EnumeratorData {
  name: string;
  submissions: SubmissionData[];
  totalSubmissions: number;
  submissionsWithAlerts: number;
  errorRate: number;
  submissionTrend: { date: string; count: number }[];
  filteredSubmissions?: SubmissionData[];
  filteredTotal?: number;
  filteredAlertsCount?: number;
  filteredErrorRate?: number;
}

export type TimeframeType = 'all' | '7days' | '30days' | '90days';
export type ChartTabType = 'volume' | 'trends' | 'quality' | 'errors';
export type DetailTabType = 'overview' | 'trends' | 'alerts'; 