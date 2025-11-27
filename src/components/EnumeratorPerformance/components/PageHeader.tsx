import React from 'react';
import { IconDatabase, IconInfoCircle } from '@tabler/icons-react';
import { useAuth } from '../../Auth/AuthContext';
import { getCountryFlag, getCountryName } from '../../../utils/countryMetadata';

interface PageHeaderProps {
  isRefreshing: boolean;
  isAdmin: boolean;
  handleAdminRefresh: () => void;
  fromDate: string;
  toDate: string;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  minDate: string;
  maxDate: string;
  selectedSurvey: string;
  setSelectedSurvey: (survey: string) => void;
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  availableSurveys: string[];
  availableCountries: string[];
  onShowAlertGuide?: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  isRefreshing,
  isAdmin,
  handleAdminRefresh,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  minDate,
  maxDate,
  selectedSurvey,
  setSelectedSurvey,
  selectedCountry,
  setSelectedCountry,
  availableSurveys,
  availableCountries,
  onShowAlertGuide
}) => {
  const { user } = useAuth();

  // Get country context for subtitle
  const getCountryContext = () => {
    if (!user?.country || user.country.length === 0) {
      return 'All Countries';
    }

    if (user.country.length === 1) {
      const countryCode = user.country[0];
      const flag = getCountryFlag(countryCode);
      const name = getCountryName(countryCode);
      return `${flag} ${name}`;
    }

    // Multi-country user
    return user.country.map(code => `${getCountryFlag(code)} ${getCountryName(code)}`).join(', ');
  };

  const countryContext = getCountryContext();

  return (
    <div className="page-header d-print-none">
      <div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col">
            <h2 className="page-title">Enumerator Performance Dashboard</h2>
            <div className="text-muted mt-1">
              Monitor and analyze data collection performance metrics
              {countryContext && (
                <span className="ms-2 badge bg-blue-lt">{countryContext}</span>
              )}
            </div>
          </div>
          <div className="col-auto ms-auto d-print-none">
            <div className="row g-2 align-items-end">
              {/* Survey Filter - Always show if multiple surveys, one must be selected */}
              {availableSurveys.length > 1 && (
                <div className="col-auto">
                  <div className="input-group">
                    <span className="input-group-text">Survey</span>
                    <select
                      className="form-select mw-12"
                      value={selectedSurvey}
                      onChange={e => setSelectedSurvey(e.target.value)}
                    >
                      {availableSurveys.map(survey => (
                        <option key={survey} value={survey}>
                          {survey}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Country Filter */}
              {availableCountries.length > 1 && (
                <div className="col-auto">
                  <div className="input-group">
                    <span className="input-group-text">Country</span>
                    <select
                      className="form-select"
                      value={selectedCountry}
                      onChange={e => setSelectedCountry(e.target.value)}
                    >
                      <option value="">All Countries</option>
                      {availableCountries.map(countryCode => (
                        <option key={countryCode} value={countryCode}>
                          {getCountryFlag(countryCode)} {getCountryName(countryCode)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Date Range Filter */}
              <div className="col-auto">
                <div className="input-group">
                  <input
                    type="date"
                    className="form-control"
                    value={fromDate}
                    min={minDate}
                    max={toDate || maxDate}
                    onChange={e => setFromDate(e.target.value)}
                    aria-label="From date"
                  />
                  <span className="input-group-text">to</span>
                  <input
                    type="date"
                    className="form-control"
                    value={toDate}
                    min={fromDate || minDate}
                    max={maxDate}
                    onChange={e => setToDate(e.target.value)}
                    aria-label="To date"
                  />
                </div>
              </div>

              {/* Alert Guide Button */}
              {onShowAlertGuide && (
                <div className="col-auto">
                  <button
                    className="btn btn-primary"
                    onClick={onShowAlertGuide}
                  >
                    <IconInfoCircle className="icon me-1" size={20} stroke={2} />
                    Alert Guide
                  </button>
                </div>
              )}

              {/* Refresh Data Button */}
              {isAdmin && (
                <div className="col-auto">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={handleAdminRefresh}
                    disabled={isRefreshing}
                  >
                    <IconDatabase className="icon me-1" size={20} stroke={2} />
                    Refresh Data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 