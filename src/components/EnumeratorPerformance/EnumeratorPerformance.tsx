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
  const { data: rawData = [], accessibleSurveys, selectedSurvey, setSelectedSurvey, isLoading, error, refetch } = useFetchEnumeratorStats();
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

  // Alert Guide modal state
  const [showAlertGuide, setShowAlertGuide] = useState(false);

  // Derive country for the selected survey from metadata.
  // For single-survey users, selectedSurvey may be null on first render — fall back to the only accessible survey.
  const surveyCountry = useMemo(() => {
    const survey = selectedSurvey
      ? accessibleSurveys.find((s: any) => s.asset_id === selectedSurvey)
      : accessibleSurveys[0];
    return survey?.country_id || '';
  }, [selectedSurvey, accessibleSurveys]);

  const { surveyAlertCodes } = useContextualAlertCodes(rawData as any);

  // Process raw data from the hook (already filtered to selected survey by backend)
  const processedData = useMemo<EnumeratorData[]>(() => {
    if (!rawData || rawData.length === 0) return [];
    return processEnumeratorData(rawData);
  }, [rawData]);

  // Manage selected enumerator when survey/data changes
  useEffect(() => {
    if (processedData.length > 0 && !selectedEnumerator) {
      setSelectedEnumerator(processedData[0].name);
    } else if (processedData.length > 0 && selectedEnumerator) {
      const exists = processedData.some(e => e.name === selectedEnumerator);
      if (!exists) {
        setSelectedEnumerator(processedData[0].name);
      }
    }
  }, [processedData, selectedEnumerator]);

  // Compute min/max dates from processedData - reset when survey changes
  useEffect(() => {
    if (processedData.length > 0) {
      const allDates = processedData.flatMap(e =>
        e.submissions.map(s => {
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
        setFromDate(sorted[0]);
        setToDate(sorted[sorted.length - 1]);
      }
    }
  }, [processedData]);

  // Apply date range filtering — derived directly, no intermediate state
  const enumerators = useMemo<EnumeratorData[]>(() => {
    if (processedData.length === 0) return [];
    const filterByDateRange = (date: string) => {
      const datePart = date.includes('T') ? date.split('T')[0] : date.split(' ')[0];
      const fromOk = fromDate ? datePart >= fromDate : true;
      const toOk = toDate ? datePart <= toDate : true;
      return fromOk && toOk;
    };
    return processedData.map(enumerator => {
      const filteredSubmissions = enumerator.submissions.filter(submission => {
        if (!submission.submission_date) return false;
        return filterByDateRange(submission.submission_date);
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
  }, [processedData, fromDate, toDate]);

  // Calculate dates for submission trend chart — must be above early returns (Rules of Hooks)
  const uniqueDates = useMemo(() => {
    const allDates = enumerators.flatMap(e =>
      e.submissionTrend
        .filter(trend => {
          const datePart = trend.date.includes('T') ? trend.date.split('T')[0] : trend.date.split(' ')[0];
          const fromOk = fromDate ? datePart >= fromDate : true;
          const toOk = toDate ? datePart <= toDate : true;
          return fromOk && toOk;
        })
        .map(trend => trend.date)
    );
    return [...new Set(allDates)].sort();
  }, [enumerators, fromDate, toDate]);

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
              <button className="btn btn-outline-primary" onClick={() => refetch()}>
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
        accessibleSurveys={accessibleSurveys}
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
