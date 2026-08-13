import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';
import { SurveyScopedRow } from '../types/validation';

const API_BASE_URL = getApiBaseUrl();

interface SurveyAlertCodes {
  surveyName: string;
  surveyCountry: string;
  assetId: string;
  alertCodes: Record<string, string>;
}

interface AlertCodesResult {
  surveyAlertCodes: SurveyAlertCodes[];
  isLoading: boolean;
}

/**
 * Hook to fetch alert codes grouped by survey
 * Returns only surveys present in the current data with their full alert code definitions
 *
 * This allows users to select which survey's alert codes they want to view
 *
 * Takes only the survey-identifying fields, so both submission rows and enumerator-stats
 * rows can be passed without a cast.
 */
export const useContextualAlertCodes = (submissions: SurveyScopedRow[]): AlertCodesResult => {
  const [surveyAlertCodes, setSurveyAlertCodes] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Get unique asset_ids from current submissions
  const uniqueAssetIds = useMemo(() => {
    const assetIds = new Set<string>();
    submissions.forEach(sub => {
      if (sub.asset_id) {
        assetIds.add(sub.asset_id);
      }
    });
    return Array.from(assetIds);
  }, [submissions]);

  // Stable identity for the *set* of surveys: the array is rebuilt every render, so depending
  // on it directly would refetch continuously.
  const assetIdsKey = uniqueAssetIds.join(',');

  // Fetch alert codes for all unique surveys in the data
  useEffect(() => {
    if (uniqueAssetIds.length === 0) {
      setSurveyAlertCodes({});
      setIsLoading(false);
      return;
    }

    const fetchAlertCodes = async () => {
      setIsLoading(true);
      try {
        const promises = uniqueAssetIds.map(async (assetId) => {
          try {
            const response = await axios.get(`${API_BASE_URL}/surveys/${assetId}/alert-codes`);
            return {
              assetId,
              codes: response.data.alert_codes || {}
            };
          } catch (error) {
            console.error(`Failed to fetch alert codes for survey ${assetId}:`, error);
            return {
              assetId,
              codes: {}
            };
          }
        });

        const results = await Promise.all(promises);

        const codesMap: Record<string, Record<string, string>> = {};
        results.forEach(result => {
          codesMap[result.assetId] = result.codes;
        });

        setSurveyAlertCodes(codesMap);
      } catch (error) {
        console.error('Error fetching alert codes:', error);
        setSurveyAlertCodes({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlertCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on assetIdsKey by design
  }, [assetIdsKey]); // Only refetch when the set of surveys changes

  // Group alert codes by survey (only include surveys present in current data)
  const groupedAlertCodes = useMemo(() => {
    const result: SurveyAlertCodes[] = [];

    // Get unique surveys from submissions
    const surveysInData = new Map<string, { name: string; country: string }>();
    submissions.forEach(sub => {
      if (sub.asset_id && !surveysInData.has(sub.asset_id)) {
        surveysInData.set(sub.asset_id, {
          name: sub.survey_name || 'Unknown Survey',
          country: sub.survey_country || ''
        });
      }
    });

    // Build result array with survey info and their alert codes
    surveysInData.forEach((surveyInfo, assetId) => {
      const codes = surveyAlertCodes[assetId] || {};

      // Only include if we have alert codes for this survey
      if (Object.keys(codes).length > 0) {
        result.push({
          surveyName: surveyInfo.name,
          surveyCountry: surveyInfo.country,
          assetId: assetId,
          alertCodes: codes
        });
      }
    });

    // Sort by survey name
    return result.sort((a, b) => a.surveyName.localeCompare(b.surveyName));
  }, [submissions, surveyAlertCodes]);

  return {
    surveyAlertCodes: groupedAlertCodes,
    isLoading
  };
};

export type { SurveyAlertCodes };
