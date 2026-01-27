import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEnumeratorStats } from '../../api/api';
import { ChartTabType, DetailTabType, EnumeratorData } from './types';
import { processEnumeratorData, findBestEnumerator } from './utils/dataUtils';
import { refreshEnumeratorStats } from './utils/apiUtils';
import { useContextualAlertCodes } from '../../hooks/useContextualAlertCodes';

// Components
import PageHeader from './components/PageHeader';
import SummaryCards from './components/SummaryCards';
import ChartTabs from './components/ChartTabs';
import EnumeratorDetail from './components/EnumeratorDetail';
import AlertGuideModal from '../ValidationTable/AlertGuideModal';

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
  const { t } = useTranslation('enumerators');
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

  // Survey filter state
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [availableSurveys, setAvailableSurveys] = useState<string[]>([]);
  const [surveyCountry, setSurveyCountry] = useState<string>('');

  // Alert Guide modal state
  const [showAlertGuide, setShowAlertGuide] = useState(false);

  // Use the same hook as ValidationTable - rawData is already in the correct format
  const { surveyAlertCodes } = useContextualAlertCodes(rawData as any);

  // PERFORMANCE FIX: Use useMemo instead of useEffect for survey extraction
  // This prevents unnecessary re-computations on every render
  const availableSurveysComputed = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    // Extract unique surveys
    const surveys = new Set<string>();
    rawData.forEach((item: any) => {
      if (item.survey_name) surveys.add(item.survey_name);
    });
    return Array.from(surveys).sort();
  }, [rawData]);

  // Update state and auto-select when available surveys change
  useEffect(() => {
    setAvailableSurveys(availableSurveysComputed);

    // Auto-select first survey if multiple surveys and none selected
    if (availableSurveysComputed.length > 1 && !selectedSurvey) {
      setSelectedSurvey(availableSurveysComputed[0]);
    } else if (availableSurveysComputed.length === 1) {
      // If only one survey, select it automatically
      setSelectedSurvey(availableSurveysComputed[0]);
    }
  }, [availableSurveysComputed, selectedSurvey]);

  // PERFORMANCE FIX: Use useMemo for data filtering and processing
  // This prevents unnecessary re-computations on every render
  const filteredRawData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    if (selectedSurvey) {
      return rawData.filter((item: any) => item.survey_name === selectedSurvey);
    }
    return rawData;
  }, [rawData, selectedSurvey]);

  // Extract survey country from filtered data
  useEffect(() => {
    if (filteredRawData.length > 0 && selectedSurvey) {
      const surveyItem = filteredRawData.find((item: any) => item.survey_country);
      setSurveyCountry(surveyItem?.survey_country || '');
    } else {
      setSurveyCountry('');
    }
  }, [filteredRawData, selectedSurvey]);

  // PERFORMANCE FIX: Memoize processed enumerator data
  const processedDataComputed = useMemo(() => {
    if (filteredRawData.length === 0) return [];
    return processEnumeratorData(filteredRawData);
  }, [filteredRawData]);

  // Update state and handle enumerator selection
  useEffect(() => {
    setProcessedData(processedDataComputed);

    // Set default selected enumerator from processed data
    if (processedDataComputed.length > 0 && !selectedEnumerator) {
      setSelectedEnumerator(processedDataComputed[0].name);
    } else if (processedDataComputed.length > 0 && selectedEnumerator) {
      // Check if selected enumerator exists in the new processed data
      const exists = processedDataComputed.some(e => e.name === selectedEnumerator);
      if (!exists) {
        setSelectedEnumerator(processedDataComputed[0].name);
      }
    }
  }, [processedDataComputed, selectedEnumerator]);

  // Compute min/max dates from processedData - reset when survey changes
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
        // Always reset date range to match the selected survey's data range
        setFromDate(sorted[0]);
        setToDate(sorted[sorted.length - 1]);
      }
    }
  }, [processedData]);

  // Apply date range filtering to data (survey filtering already done in processedData)
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

        // Date filter only - survey filtering already applied to processedData
        if (!filterByDateRange(submission.submission_date)) return false;

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
  }, [processedData, fromDate, toDate]);

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
      const token = prompt(t('adminTokenPrompt'));
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
      setRefreshMessage(t('refreshError'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Note: Popover initialization is now handled in the ChartTabs component

  // Loading state
  if (isLoading) {
    return (
      <div className="page-body">
        <div className="container-xl">
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="page-body">
        <div className="container-xl">
          <div className="alert alert-danger" role="alert">
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
                {t('buttons.tryAgain', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (enumerators.length === 0) {
    return (
      <div className="page-body">
        <div className="container-xl">
          <div className="alert alert-info" role="alert">
            <div className="d-flex">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                  <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                  <path d="M12 8l.01 0"></path>
                  <path d="M11 12h1v4h1"></path>
                </svg>
              </div>
              <div className="ms-2">{t('noData')}</div>
            </div>
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
    <>
      {/* Page Header */}
      <PageHeader
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
        availableSurveys={availableSurveys}
        surveyCountry={surveyCountry}
        onShowAlertGuide={() => setShowAlertGuide(true)}
      />

      {/* Page Body */}
      <div className="page-body">
        <div className="container-xl">
          {refreshMessage && (
            <div className={`alert ${refreshMessage.includes('Error') ? 'alert-danger' : 'alert-success'} mb-3`}>
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

          {/* Alert Guide Modal */}
          {showAlertGuide && (
            <AlertGuideModal
              onClose={() => setShowAlertGuide(false)}
              surveyAlertCodes={surveyAlertCodes}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default EnumeratorPerformance; 