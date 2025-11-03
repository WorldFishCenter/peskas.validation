import React from 'react';
import { IconDatabase } from '@tabler/icons-react';
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
  availableCountries
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
    <div className="page-header d-print-none mb-4">
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
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Survey Filter */}
              {availableSurveys.length > 1 && (
                <div className="input-group" style={{ width: 'auto' }}>
                  <span className="input-group-text">Survey</span>
                  <select
                    className="form-select"
                    value={selectedSurvey}
                    onChange={e => setSelectedSurvey(e.target.value)}
                  >
                    <option value="">All Surveys</option>
                    {availableSurveys.map(survey => (
                      <option key={survey} value={survey}>
                        {survey}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Country Filter */}
              {availableCountries.length > 1 && (
                <div className="input-group" style={{ width: 'auto' }}>
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
              )}

              {/* Date Range Filter */}
              <div className="d-flex align-items-center gap-2">
                <div className="d-flex flex-column align-items-start">
                  <label htmlFor="from-date" className="form-label mb-0 small">From</label>
                  <input
                    id="from-date"
                    type="date"
                    className="form-control"
                    value={fromDate}
                    min={minDate}
                    max={toDate || maxDate}
                    onChange={e => setFromDate(e.target.value)}
                  />
                </div>
                <div className="d-flex flex-column align-items-start">
                  <label htmlFor="to-date" className="form-label mb-0 small">To</label>
                  <input
                    id="to-date"
                    type="date"
                    className="form-control"
                    value={toDate}
                    min={fromDate || minDate}
                    max={maxDate}
                    onChange={e => setToDate(e.target.value)}
                  />
                </div>
              </div>
              {isAdmin && (
                <button
                  className="btn btn-outline-secondary d-flex align-items-center"
                  onClick={handleAdminRefresh}
                  disabled={isRefreshing}
                >
                  <IconDatabase className="icon me-1" size={20} stroke={2} />
                  Refresh Data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 