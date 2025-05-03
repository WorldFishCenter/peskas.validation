import React, { useState, useEffect } from 'react';
import { useFetchEnumeratorStats } from '../../api/api';
import { TimeframeType, ChartTabType, DetailTabType, EnumeratorData } from './types';
import { processEnumeratorData, applyTimeFiltering, filterByTimeframe, findBestEnumerator } from './utils/dataUtils';
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
  const [timeframe, setTimeframe] = useState<TimeframeType>('all');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTabType>('volume');
  const [detailActiveTab, setDetailActiveTab] = useState<DetailTabType>('overview');

  // Process the raw data into the format needed for the charts - do this only once
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      console.log('Processing raw data...', rawData.length, 'records');
      const processed = processEnumeratorData(rawData);
      setProcessedData(processed);
      
      // Set default selected enumerator
      if (processed.length > 0 && !selectedEnumerator) {
        setSelectedEnumerator(processed[0].name);
      }
    }
  }, [rawData]); // Remove selectedEnumerator dependency to avoid re-processing

  // Apply time filtering to data when timeframe or processed data changes
  useEffect(() => {
    if (processedData.length === 0) return;
    
    console.log(`Applying ${timeframe} filter to processed data...`);
    const filteredEnumerators = applyTimeFiltering(processedData, timeframe);
    setEnumerators(filteredEnumerators);
  }, [timeframe, processedData]); 

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

  // Initialize all popovers after component has rendered
  useEffect(() => {
    // Check if Bootstrap's popover function exists
    if (typeof document !== 'undefined' && (window as any).bootstrap?.Popover) {
      const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
      [...popoverTriggerList].map(popoverTriggerEl => {
        return new (window as any).bootstrap.Popover(popoverTriggerEl);
      });
    }
  }, [activeTab]); // Re-initialize when tab changes

  // Loading state
  if (isLoading) {
    return (
      <div className="container-xl">
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
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
  
  // Calculate dates for submission trend chart
  const allDates = enumerators.flatMap(e => 
    e.submissionTrend
      .filter(t => filterByTimeframe(t.date, timeframe))
      .map(t => t.date)
  );
  const uniqueDates = [...new Set(allDates)].sort();

  const filterByTimeframeWithCurry = (date: string) => filterByTimeframe(date, timeframe);

  return (
    <div className="container-xl">
      {/* Page header with actions */}
      <PageHeader 
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        refetch={refetch}
        isRefreshing={isRefreshing}
        isAdmin={isAdmin}
        handleAdminRefresh={handleAdminRefresh}
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
        timeframe={timeframe}
        onEnumeratorSelect={setSelectedEnumerator}
        uniqueDates={uniqueDates}
        filterByTimeframe={filterByTimeframeWithCurry}
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
          timeframe={timeframe}
          filterByTimeframe={filterByTimeframeWithCurry}
        />
      )}
    </div>
  );
};

export default EnumeratorPerformance; 