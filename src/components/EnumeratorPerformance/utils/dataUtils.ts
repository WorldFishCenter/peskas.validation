import { EnumeratorData, SubmissionData, TimeframeType } from '../types';

/**
 * Filter submissions by timeframe
 */
export const filterByTimeframe = (date: string, timeframe: TimeframeType): boolean => {
  if (timeframe === 'all') return true;
  
  try {
    const now = new Date();
    
    // Check if date is valid
    if (!date || typeof date !== 'string') {
      console.warn('Invalid date format received:', date);
      return false;
    }
    
    const submissionDate = new Date(date);
    
    // Handle invalid dates
    if (isNaN(submissionDate.getTime())) {
      console.warn('Invalid date conversion:', date);
      return false;
    }
    
    // Set both dates to the start of day to avoid time differences affecting calculations
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const subDate = new Date(submissionDate.getFullYear(), submissionDate.getMonth(), submissionDate.getDate());
    
    // Calculate days difference (more accurate)
    const daysDifference = Math.floor((nowDate.getTime() - subDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (timeframe === '7days') return daysDifference < 7;
    if (timeframe === '30days') return daysDifference < 30;
    if (timeframe === '90days') return daysDifference < 90;
    
    return true;
  } catch (error) {
    console.error('Error in filterByTimeframe:', error, 'for date:', date);
    return false;
  }
};

/**
 * Process raw data into EnumeratorData format
 */
export const processEnumeratorData = (rawData: SubmissionData[]): EnumeratorData[] => {
  if (!rawData || rawData.length === 0) return [];
  
  // Format data from the raw submissions
  const processedData: Record<string, any> = {};
  
  // Group by enumerator
  rawData.forEach((item: SubmissionData) => {
    // Skip items with missing or "Unknown" enumerator name
    if (!item.submitted_by || item.submitted_by === 'Unknown') {
      return;
    }
    
    const enumerator = item.submitted_by;
    
    if (!processedData[enumerator]) {
      processedData[enumerator] = {
        name: enumerator,
        submissions: [],
        totalSubmissions: 0,
        submissionsWithAlerts: 0,
        submissionTrend: {}
      };
    }
    
    processedData[enumerator].submissions.push(item);
    processedData[enumerator].totalSubmissions++;
    
    // Count submissions with alerts
    if (item.alert_flag && item.alert_flag !== "NA") {
      processedData[enumerator].submissionsWithAlerts++;
    }
    
    // Track submission trends by date - Add null check for submission_date
    if (item.submission_date) {
      // Parse date safely, handling different formats
      let dateStr = item.submission_date;
      
      // Extract just the date part (handles both ISO formats and other formats with spaces)
      const datePart = dateStr.includes('T') 
        ? dateStr.split('T')[0]  // Handle ISO format: "2025-02-19T00:00:00"
        : dateStr.split(' ')[0]; // Handle space format: "2025-02-19 00:00:00"
        
      if (datePart) {
        if (!processedData[enumerator].submissionTrend[datePart]) {
          processedData[enumerator].submissionTrend[datePart] = 0;
        }
        processedData[enumerator].submissionTrend[datePart]++;
      }
    }
  });
  
  // Calculate error rates and format the data for charts
  const formattedData = Object.values(processedData).map((enumerator: any) => {
    // Calculate error rate
    const errorRate = enumerator.totalSubmissions > 0 
      ? (enumerator.submissionsWithAlerts / enumerator.totalSubmissions) * 100 
      : 0;
    
    // Format submission trend for the chart
    const submissionTrend = Object.entries(enumerator.submissionTrend).map(
      ([date, count]: [string, any]) => ({ date, count })
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return {
      ...enumerator,
      errorRate,
      submissionTrend
    } as EnumeratorData;
  });
  
  // Sort by total submissions (descending)
  return formattedData.sort((a, b) => b.totalSubmissions - a.totalSubmissions);
};

/**
 * Apply time filtering to enumerator data
 */
export const applyTimeFiltering = (
  enumerators: EnumeratorData[],
  timeframe: TimeframeType
): EnumeratorData[] => {
  if (enumerators.length === 0) return [];

  // Recalculate stats based on time filter
  return enumerators.map(enumerator => {
    try {
      // Filter submissions by timeframe
      const filteredSubmissions = enumerator.submissions.filter(submission => {
        if (!submission.submission_date) return false;
        
        // Extract date part from submission_date, handling different formats
        let datePart;
        if (submission.submission_date.includes('T')) {
          // Handle ISO format: "2025-02-19T00:00:00"
          datePart = submission.submission_date.split('T')[0];
        } else {
          // Handle space format: "2025-02-19 00:00:00"
          datePart = submission.submission_date.split(' ')[0];
        }
        
        return filterByTimeframe(datePart, timeframe);
      });
      
      // Count submissions with alerts in the filtered timeframe
      const submissionsWithAlerts = filteredSubmissions.filter(
        s => s.alert_flag && s.alert_flag !== "NA"
      ).length;
      
      // Calculate new error rate based on filtered data
      const errorRate = filteredSubmissions.length > 0
        ? (submissionsWithAlerts / filteredSubmissions.length) * 100
        : 0;

      return {
        ...enumerator,
        filteredSubmissions,
        filteredTotal: filteredSubmissions.length,
        filteredAlertsCount: submissionsWithAlerts,
        filteredErrorRate: errorRate
      };
    } catch (error) {
      console.error(`Error filtering enumerator ${enumerator.name}:`, error);
      // Return unfiltered data in case of error
      return {
        ...enumerator,
        filteredSubmissions: [],
        filteredTotal: 0,
        filteredAlertsCount: 0,
        filteredErrorRate: 0
      };
    }
  });
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
      submissions: [],
      totalSubmissions: 0,
      submissionsWithAlerts: 0,
      submissionTrend: []
    };
  }

  // Filter to enumerators with sufficient submissions for meaningful comparison
  const qualified = enumerators.filter(e => {
    const submissions = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
    return submissions >= minSubmissions;
  });

  // If no one meets the minimum, lower the threshold and try again
  if (qualified.length === 0) {
    const lowerThreshold = Math.max(1, Math.floor(minSubmissions / 2));
    const secondAttempt = enumerators.filter(e => {
      const submissions = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
      return submissions >= lowerThreshold;
    });

    // If still no one qualifies, return the one with most submissions
    if (secondAttempt.length === 0) {
      return enumerators.reduce((best, current) => {
        const bestSubs = best.filteredTotal ?? best.totalSubmissions;
        const currentSubs = current.filteredTotal ?? current.totalSubmissions;
        return currentSubs > bestSubs ? current : best;
      }, enumerators[0]);
    }

    // Use the lower threshold candidates
    return secondAttempt.reduce((best, current) => {
      const bestError = best.filteredErrorRate !== undefined ? best.filteredErrorRate : best.errorRate;
      const currentError = current.filteredErrorRate !== undefined ? current.filteredErrorRate : current.errorRate;

      // Prioritize quality (lowest error rate)
      if (currentError < bestError) return current;
      if (currentError > bestError) return best;

      // If equal quality, prefer higher volume
      const bestSubs = best.filteredTotal ?? best.totalSubmissions;
      const currentSubs = current.filteredTotal ?? current.totalSubmissions;
      return currentSubs > bestSubs ? current : best;
    }, secondAttempt[0]);
  }

  // Find the enumerator with the lowest error rate among qualified candidates
  return qualified.reduce((best, current) => {
    const bestError = best.filteredErrorRate !== undefined ? best.filteredErrorRate : best.errorRate;
    const currentError = current.filteredErrorRate !== undefined ? current.filteredErrorRate : current.errorRate;

    // Prioritize quality (lowest error rate wins)
    if (currentError < bestError) return current;
    if (currentError > bestError) return best;

    // If error rates are equal, prefer higher volume as tiebreaker
    const bestSubs = best.filteredTotal ?? best.totalSubmissions;
    const currentSubs = current.filteredTotal ?? current.totalSubmissions;
    return currentSubs > bestSubs ? current : best;
  }, qualified[0]);
}; 