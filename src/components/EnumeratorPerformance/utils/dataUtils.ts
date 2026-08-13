import { EnumeratorData, SubmissionData } from '../types';

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
      const dateStr = item.submission_date;
      
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