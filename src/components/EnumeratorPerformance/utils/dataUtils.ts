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
 * Find the best performing enumerator
 */
export const findBestEnumerator = (enumerators: EnumeratorData[]): EnumeratorData => {
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
  
  return enumerators.reduce((best, current) => {
    // Only consider enumerators with at least 5 submissions
    const currentSubmissions = current.filteredTotal !== undefined ? current.filteredTotal : current.totalSubmissions;
    const bestSubmissions = best.filteredTotal !== undefined ? best.filteredTotal : best.totalSubmissions;
    
    if (currentSubmissions < 5) return best;
    if (bestSubmissions < 5 && currentSubmissions >= 5) return current;
    
    // Calculate quality scores
    const bestQualityScore = 100 - (best.filteredErrorRate !== undefined ? best.filteredErrorRate : best.errorRate);
    const currentQualityScore = 100 - (current.filteredErrorRate !== undefined ? current.filteredErrorRate : current.errorRate);
    
    // Calculate weighted scores that consider both quality and volume
    // Using logarithmic scale to balance between quality and quantity
    const bestWeightedScore = bestQualityScore * Math.log10(bestSubmissions + 1);
    const currentWeightedScore = currentQualityScore * Math.log10(currentSubmissions + 1);
    
    return currentWeightedScore > bestWeightedScore ? current : best;
  }, enumerators[0]);
}; 