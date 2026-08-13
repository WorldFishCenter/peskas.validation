import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';
import { extractErrorMessage } from '../utils/errors';
import { useSurveyContext } from '../contexts/SurveyContext';

// Get the appropriate API base URL based on environment
const API_BASE_URL = getApiBaseUrl();

import { Submission, SubmissionData, AccessibleSurvey } from '../types/validation';
import {
  DownloadFilters,
  PreviewResponse,
  FieldMetadata,
  DataRow,
  CountryOption,
  District,
  Survey
} from '../types/download';

// Normalize field names for consistent access
const normalizeSubmissionData = (item: Record<string, unknown>): Submission => {
  // Create a new object with all keys from the original
  const normalized = { ...item } as unknown as Submission & { _submitted_by?: unknown };


  // Handle common field name transformations
  if (!normalized.submitted_by && normalized._submitted_by) {
    normalized.submitted_by = String(normalized._submitted_by);
  }

  // Ensure submitted_by is always a string, even if empty
  normalized.submitted_by = normalized.submitted_by ? String(normalized.submitted_by) : '';


  return normalized;
};

/**
 * Serialize download filters into a query string.
 *
 * Empty values are dropped and arrays are joined with commas, which is what the
 * data-download endpoints expect. Shared by the preview hook and the CSV export so the
 * two cannot drift apart.
 */
const buildDownloadQuery = (filters: DownloadFilters): string => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length > 0) params.append(key, value.join(','));
    } else {
      params.append(key, String(value));
    }
  });
  return params.toString();
};

// Hook to fetch submissions
export const useFetchSubmissions = () => {
  const { selectedSurveyId, setSelectedSurveyId } = useSurveyContext();
  const [data, setData] = useState<Submission[]>([]);
  const [accessibleSurveys, setAccessibleSurveys] = useState<AccessibleSurvey[]>([]);
  const [alertCodes, setAlertCodes] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read selectedSurveyId via a ref so fetchData never needs to be recreated
  // when the context value changes. Calling setSelectedSurveyId inside fetchData
  // is therefore safe — it won't trigger a second useEffect-driven fetch.
  const selectedSurveyRef = useRef<string | null>(selectedSurveyId);
  useEffect(() => { selectedSurveyRef.current = selectedSurveyId; }, [selectedSurveyId]);

  // Track the AbortController for the current in-flight request so that
  // a new call (or StrictMode remount) can cancel the previous one.
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (forcedSurveyId?: string | null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      setError(null);

      const surveyToFetch = forcedSurveyId !== undefined ? forcedSurveyId : selectedSurveyRef.current;

      const params: Record<string, string> = {};
      if (surveyToFetch) {
        params.survey_id = surveyToFetch;
      }

      const response = await axios.get(`${API_BASE_URL}/kobo/submissions`, {
        params,
        signal: controller.signal,
      });

      // Handle case where backend requires survey selection
      if (response.data.message === 'Please select a survey to view submissions') {
        setData([]);
        if (response.data.metadata?.accessible_surveys) {
          const surveys = response.data.metadata.accessible_surveys;
          setAccessibleSurveys(surveys);

          if (surveys.length > 0 && !surveyToFetch) {
            const firstSurvey = surveys[0].asset_id;
            // Update ref immediately so the recursive call uses the right id.
            // setSelectedSurveyId is safe here — fetchData is stable and won't
            // be recreated, so this won't trigger an extra useEffect run.
            selectedSurveyRef.current = firstSurvey;
            setSelectedSurveyId(firstSurvey);
            return await fetchData(firstSurvey);
          }
        }
        return;
      }

      if (!Array.isArray(response.data.results)) {
        setData([]);
        return;
      }

      setData(response.data.results.map(normalizeSubmissionData));

      if (response.data.metadata?.accessible_surveys) {
        const surveys = response.data.metadata.accessible_surveys;
        setAccessibleSurveys(surveys);

        const codesMap: Record<string, Record<string, string>> = {};
        surveys.forEach((survey: AccessibleSurvey) => {
          if (survey.alert_codes) {
            codesMap[survey.asset_id] = survey.alert_codes;
          }
        });
        setAlertCodes(codesMap);

        // For single-survey users: sync the context so other pages know which
        // survey is active. Safe — fetchData is stable, so this won't retrigger
        // the useEffect below.
        if (!surveyToFetch && surveys.length === 1) {
          selectedSurveyRef.current = surveys[0].asset_id;
          setSelectedSurveyId(surveys[0].asset_id);
        }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(extractErrorMessage(err, 'Failed to load submissions'));
      setData([]);
      setAccessibleSurveys([]);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  // setSelectedSurveyId from useState is always stable — no other deps needed.
  }, [setSelectedSurveyId]);

  useEffect(() => {
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [fetchData]);

  return {
    data,
    accessibleSurveys,
    alertCodes,
    selectedSurvey: selectedSurveyId,
    setSelectedSurvey: setSelectedSurveyId,
    isLoading,
    error,
    refetch: fetchData
  };
};

// Hook to fetch enumerator statistics from the new MongoDB collection
export const useFetchEnumeratorStats = () => {
  const { selectedSurveyId, setSelectedSurveyId } = useSurveyContext();
  const [data, setData] = useState<SubmissionData[]>([]);
  const [accessibleSurveys, setAccessibleSurveys] = useState<AccessibleSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedSurveyRef = useRef<string | null>(selectedSurveyId);
  useEffect(() => { selectedSurveyRef.current = selectedSurveyId; }, [selectedSurveyId]);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (forcedSurveyId?: string | null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      setError(null);

      const surveyToFetch = forcedSurveyId !== undefined ? forcedSurveyId : selectedSurveyRef.current;

      const params: Record<string, string> = {};
      if (surveyToFetch) {
        params.survey_id = surveyToFetch;
      }

      const response = await axios.get(`${API_BASE_URL}/enumerators-stats`, {
        params,
        signal: controller.signal,
      });

      if (response.data.message === 'Please select a survey to view statistics') {
        setData([]);
        if (response.data.metadata?.accessible_surveys) {
          const surveys = response.data.metadata.accessible_surveys;
          setAccessibleSurveys(surveys);

          if (surveys.length > 0 && !surveyToFetch) {
            const firstSurvey = surveys[0].asset_id;
            selectedSurveyRef.current = firstSurvey;
            setSelectedSurveyId(firstSurvey);
            return await fetchData(firstSurvey);
          }
        }
        return;
      }

      if (!Array.isArray(response.data.results)) {
        setData([]);
        return;
      }
      setData(response.data.results);

      if (response.data.metadata?.accessible_surveys) {
        const surveys = response.data.metadata.accessible_surveys;
        setAccessibleSurveys(surveys);
        if (!surveyToFetch && surveys.length === 1) {
          selectedSurveyRef.current = surveys[0].asset_id;
          setSelectedSurveyId(surveys[0].asset_id);
        }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(extractErrorMessage(err, 'Failed to load enumerator statistics'));
      setData([]);
      setAccessibleSurveys([]);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  // setSelectedSurveyId from useState is always stable — no other deps needed.
  }, [setSelectedSurveyId]);

  useEffect(() => {
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [fetchData]);

  return {
    data,
    accessibleSurveys,
    selectedSurvey: selectedSurveyId,
    setSelectedSurvey: setSelectedSurveyId,
    isLoading,
    error,
    refetch: fetchData
  };
};

// ========================================
// DATA DOWNLOAD HOOKS
// ========================================

/**
 * Hook to fetch download preview data
 *
 * Fetches the first 20 rows of data based on selected filters
 * to preview before downloading the full dataset.
 */
export const useFetchDownloadPreview = () => {
  const [data, setData] = useState<DataRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [appliedFilters, setAppliedFilters] = useState<DownloadFilters | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async (filters: DownloadFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get<PreviewResponse>(
        `${API_BASE_URL}/data-download/preview?${buildDownloadQuery(filters)}`
      );

      setData(response.data.data);
      setTotalCount(response.data.total_count);
      setAppliedFilters(response.data.filters_applied);
    } catch (err: unknown) {
      console.error('Error fetching preview:', err);
      setError(extractErrorMessage(err, 'Failed to fetch preview'));
      setData([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, totalCount, appliedFilters, isLoading, error, fetchPreview };
};

/**
 * Function to trigger CSV download
 *
 * Downloads the full dataset as CSV based on selected filters.
 * Triggers browser download with appropriate filename.
 *
 * @param filters - Download filters to apply
 * @returns Promise<boolean> - true if download succeeded, false otherwise
 */
export const downloadCSV = async (filters: DownloadFilters): Promise<boolean> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/data-download/export?${buildDownloadQuery(filters)}`,
      {
        responseType: 'blob' // Important for file download
      }
    );

    // Create blob and trigger download
    const blob = new Blob([response.data], { type: 'text/csv; charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Extract filename from Content-Disposition header or use default
    const contentDisposition = response.headers['content-disposition'];
    let filename = `peskas-landings-${new Date().toISOString().split('T')[0]}.csv`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/"/g, '');
      }
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (err) {
    console.error('Error downloading CSV:', err);
    return false;
  }
};

/**
 * Unified hook to fetch all download metadata in one request
 * Replaces useFetchCountries, useFetchDistricts, useFetchSurveys for better performance
 *
 * @param countryId - Optional country filter for districts/surveys
 * @param surveyId - Optional survey filter for districts (cascade filtering)
 */
export const useFetchDownloadMetadata = (countryId?: string, surveyId?: string) => {
  const [metadata, setMetadata] = useState<{
    countries: CountryOption[];
    districts: District[];
    surveys: Survey[];
  }>({
    countries: [],
    districts: [],
    surveys: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (countryId) params.append('country_id', countryId);
      if (surveyId) params.append('survey_id', surveyId);

      const queryString = params.toString();
      const url = `${API_BASE_URL}/data-download/metadata${queryString ? `?${queryString}` : ''}`;
      const response = await axios.get(url);

      setMetadata({
        countries: response.data.countries || [],
        districts: response.data.districts || [],
        surveys: response.data.surveys || []
      });
    } catch (err: unknown) {
      console.error('Error fetching download metadata:', err);
      setError(extractErrorMessage(err, 'Failed to load filter metadata'));
    } finally {
      setIsLoading(false);
    }
  }, [countryId, surveyId]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return {
    metadata,
    isLoading,
    error,
    refetch: fetchMetadata
  };
};

/**
 * Hook to fetch field metadata from PeSKAS API
 *
 * Fetches comprehensive field documentation including descriptions, data types,
 * units, examples, and categorical values. Used to enhance UX with field
 * descriptions in the Data Download feature.
 *
 * Features:
 * - Lazy loading: Only fetches when fetchMetadata() is called
 * - Session caching: Stores in sessionStorage to avoid repeated requests
 * - Scope filtering: Optional scope parameter to filter by trip_info or catch_info
 *
 * @param scope - Optional scope filter ('trip_info' or 'catch_info')
 * @returns Object with metadata, loading/error states, and fetch function
 */
export const useFetchFieldMetadata = (scope?: string) => {
  const [metadata, setMetadata] = useState<FieldMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate cache key based on scope
  const cacheKey = `peskas_metadata_${scope || 'all'}`;

  const fetchMetadata = useCallback(async () => {
    // Check sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setMetadata(JSON.parse(cached));
        return;
      }
    } catch (err) {
      console.warn('Failed to read metadata from cache:', err);
      // Continue to fetch from API
    }

    // Fetch from API
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (scope) params.append('scope', scope);

      const response = await axios.get<FieldMetadata>(
        `${API_BASE_URL}/data-download/metadata-fields${params.toString() ? `?${params.toString()}` : ''}`
      );

      setMetadata(response.data);

      // Cache in sessionStorage
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
      } catch (err) {
        console.warn('Failed to cache metadata:', err);
        // Continue even if caching fails
      }
    } catch (err: unknown) {
      console.error('Error fetching field metadata:', err);
      setError(extractErrorMessage(err, 'Failed to load field descriptions'));
      setMetadata(null);
    } finally {
      setIsLoading(false);
    }
  }, [scope, cacheKey]);

  return { metadata, isLoading, error, fetchMetadata };
};
