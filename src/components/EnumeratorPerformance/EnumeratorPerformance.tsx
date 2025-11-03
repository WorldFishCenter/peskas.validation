import React, { useState, useEffect } from 'react';
import { useFetchEnumeratorStats } from '../../api/api';
import { ChartTabType, DetailTabType, EnumeratorData } from './types';
import { processEnumeratorData, findBestEnumerator } from './utils/dataUtils';
import { refreshEnumeratorStats } from './utils/apiUtils';

// Components
import PageHeader from './components/PageHeader';
import SummaryCards from './components/SummaryCards';
import ChartTabs from './components/ChartTabs';
import EnumeratorDetail from './components/EnumeratorDetail';

// Add extended Highcharts types to fix TypeScript errors
declare module 'highcharts' {
  interface ChartOptions {
    zoomType?: string;
  }
  
  interface TooltipOptions {
    crosshairs?: boolean;
  }
}

const EnumeratorPerformance: React.FC = () => {
  const { data: rawData = [], isLoading, error, refetch } = useFetchEnumeratorStats();
  const [enumerators, setEnumerators] = useState<EnumeratorData[]>([]);
  const [processedData, setProcessedData] = useState<EnumeratorData[]>([]);
  const [selectedEnumerator, setSelectedEnumerator] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTabType>('volume');
  const [detailActiveTab, setDetailActiveTab] = useState<DetailTabType>('overview');

  // Date range filter state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [minDate, setMinDate] = useState<string>('');
  const [maxDate, setMaxDate] = useState<string>('');

  // Survey and country filter state
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [availableSurveys, setAvailableSurveys] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);

  // Process the raw data into the format needed for the charts - do this only once
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      const processed = processEnumeratorData(rawData);
      setProcessedData(processed);

      // Extract unique surveys and countries
      const surveys = new Set<string>();
      const countries = new Set<string>();
      rawData.forEach((item: any) => {
        if (item.survey_name) surveys.add(item.survey_name);
        if (item.survey_country) countries.add(item.survey_country);
      });
      setAvailableSurveys(Array.from(surveys).sort());
      setAvailableCountries(Array.from(countries).sort());

      // Set default selected enumerator
      if (processed.length > 0 && !selectedEnumerator) {
        setSelectedEnumerator(processed[0].name);
      }
    }
  }, [rawData]); // Remove selectedEnumerator dependency to avoid re-processing

  // Compute min/max dates from processedData
  useEffect(() => {
    if (processedData.length > 0) {
      const allDates = processedData.flatMap(e =>
        e.submissions.map(s => {
          // Extract just the date part
          if (!s.submission_date) return null;
          return s.submission_date.includes('T')
            ? s.submission_date.split('T')[0]
            : s.submission_date.split(' ')[0];
        }).filter(Boolean)
      ) as string[];
      if (allDates.length > 0) {
        const sorted = allDates.sort();
        setMinDate(sorted[0]);
        setMaxDate(sorted[sorted.length - 1]);
        // Set defaults if not already set
        setFromDate(prev => prev || sorted[0]);
        setToDate(prev => prev || sorted[sorted.length - 1]);
      }
    }
  }, [processedData]);

  // Apply date range, survey, and country filtering to data
  useEffect(() => {
    if (processedData.length === 0) return;
    const filterByDateRange = (date: string) => {
      const datePart = date.includes('T') ? date.split('T')[0] : date.split(' ')[0];
      const fromOk = fromDate ? datePart >= fromDate : true;
      const toOk = toDate ? datePart <= toDate : true;
      return fromOk && toOk;
    };
    const filteredEnumerators = processedData.map(enumerator => {
      const filteredSubmissions = enumerator.submissions.filter(submission => {
        if (!submission.submission_date) return false;

        // Date filter
        if (!filterByDateRange(submission.submission_date)) return false;

        // Survey filter
        if (selectedSurvey && submission.survey_name !== selectedSurvey) return false;

        // Country filter
        if (selectedCountry && submission.survey_country !== selectedCountry) return false;

        return true;
      });
      const submissionsWithAlerts = filteredSubmissions.filter(
        s => s.alert_flag && s.alert_flag !== "NA"
      ).length;
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
    });
    setEnumerators(filteredEnumerators);
  }, [processedData, fromDate, toDate, selectedSurvey, selectedCountry]);

  // Check for admin token
  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token');
    if (storedToken) {
      setAdminToken(storedToken);
      setIsAdmin(true);
    }
  }, []);

  // Handle admin refresh
  const handleAdminRefresh = async () => {
    if (!adminToken) {
      const token = prompt('Enter admin token to refresh data:');
      if (!token) return;
      setAdminToken(token);
      localStorage.setItem('admin_token', token);
      setIsAdmin(true);
    }

    setIsRefreshing(true);
    setRefreshMessage(null);
    
    try {
      const result = await refreshEnumeratorStats(adminToken);
      if (result.success) {
        setRefreshMessage(result.message);
        await refetch();
      } else {
        setRefreshMessage(`Error: ${result.message}`);
        if (result.message.includes('Unauthorized')) {
          setIsAdmin(false);
          localStorage.removeItem('admin_token');
        }
      }
    } catch (error) {
      setRefreshMessage('Failed to refresh data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Note: Popover initialization is now handled in the ChartTabs component

  // Loading state
  if (isLoading) {
    return (
      <div className="container-xl">
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-blue" role="status"></div>
            <div className="mt-3">Loading data...</div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container-xl">
        <div className="alert alert-danger my-4" role="alert">
          <div className="d-flex">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-alert-circle" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                <path d="M12 8v4"></path>
                <path d="M12 16h.01"></path>
              </svg>
            </div>
            <div className="ms-2">{error}</div>
          </div>
          <div className="mt-3">
            <button className="btn btn-outline-primary" onClick={refetch}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (enumerators.length === 0) {
    return (
      <div className="container-xl">
        <div className="alert alert-info my-4" role="alert">
          <div className="d-flex">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                <path d="M12 8l.01 0"></path>
                <path d="M11 12h1v4h1"></path>
              </svg>
            </div>
            <div className="ms-2">No enumerator performance data available.</div>
          </div>
        </div>
      </div>
    );
  }

  const selectedEnumeratorData = enumerators.find(e => e.name === selectedEnumerator);
  
  // Calculate summary statistics based on filtered data
  const totalSubmissions = enumerators.reduce((sum, e) => sum + (e.filteredTotal || e.totalSubmissions), 0);
  const totalAlerts = enumerators.reduce((sum, e) => sum + (e.filteredAlertsCount || e.submissionsWithAlerts), 0);
  const avgErrorRate = totalSubmissions > 0 ? (totalAlerts / totalSubmissions) * 100 : 0;
  
  // Find the best enumerator using a weighted quality score
  const bestEnumerator = findBestEnumerator(enumerators);
  
  // Calculate dates for submission trend chart (filtered by date range only)
  const allDates = enumerators.flatMap(e => 
    e.submissionTrend
      .filter(t => {
        const datePart = t.date.includes('T') ? t.date.split('T')[0] : t.date.split(' ')[0];
        const fromOk = fromDate ? datePart >= fromDate : true;
        const toOk = toDate ? datePart <= toDate : true;
        return fromOk && toOk;
      })
      .map(t => t.date)
  );
  const uniqueDates = [...new Set(allDates)].sort();

  return (
    <div className="container-xl">
      {/* Page header with actions */}
      <PageHeader
        // timeframe and setTimeframe removed
        isRefreshing={isRefreshing}
        isAdmin={isAdmin}
        handleAdminRefresh={handleAdminRefresh}
        fromDate={fromDate}
        toDate={toDate}
        setFromDate={setFromDate}
        setToDate={setToDate}
        minDate={minDate}
        maxDate={maxDate}
        selectedSurvey={selectedSurvey}
        setSelectedSurvey={setSelectedSurvey}
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        availableSurveys={availableSurveys}
        availableCountries={availableCountries}
      />

      {refreshMessage && (
        <div className={`alert ${refreshMessage.includes('Error') ? 'alert-danger' : 'alert-success'} mb-4`}>
          {refreshMessage}
        </div>
      )}

      {/* Summary statistics cards */}
      <SummaryCards 
        totalSubmissions={totalSubmissions}
        enumerators={enumerators}
        avgErrorRate={avgErrorRate}
        bestEnumerator={bestEnumerator}
      />

      {/* Main content section with tabs */}
      <ChartTabs 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        enumerators={enumerators}
        onEnumeratorSelect={setSelectedEnumerator}
        uniqueDates={uniqueDates}
      />

      {/* Detailed enumerator analysis section */}
      {selectedEnumeratorData && (
        <EnumeratorDetail 
          selectedEnumeratorData={selectedEnumeratorData}
          selectedEnumerator={selectedEnumerator}
          setSelectedEnumerator={setSelectedEnumerator}
          enumerators={enumerators}
          detailActiveTab={detailActiveTab}
          setDetailActiveTab={setDetailActiveTab}
        />
      )}
    </div>
  );
};

export default EnumeratorPerformance; 