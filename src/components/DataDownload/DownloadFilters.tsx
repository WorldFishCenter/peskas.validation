import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconSearch, IconX, IconInfoCircle } from '@tabler/icons-react';
import { DownloadFilters as FiltersType } from '../../types/download';
import { useFetchDownloadMetadata } from '../../api/api';

interface DownloadFiltersProps {
  filters: FiltersType;
  setFilters: (filters: FiltersType) => void;
  onPreview: () => void;
  onReset: () => void;
  isLoading: boolean;
  user: any;
}

const DownloadFilters: React.FC<DownloadFiltersProps> = ({
  filters,
  setFilters,
  onPreview,
  onReset,
  isLoading,
  user
}) => {
  const { t } = useTranslation('download');
  const isAdmin = user?.role === 'admin';

  // Fetch all metadata in one request (pre-filtered by server)
  const { metadata, isLoading: loadingMetadata } = useFetchDownloadMetadata(
    isAdmin ? filters.country : undefined
  );
  const { countries, districts, surveys } = metadata;

  const handleChange = (field: keyof FiltersType, value: any) => {
    // If country changes, reset survey and GAUL selections
    if (field === 'country') {
      setFilters({ ...filters, [field]: value, survey_id: [], gaul_2: [] });
    } else {
      setFilters({ ...filters, [field]: value });
    }
  };

  const handleGaulCodeSelect = (code: string) => {
    // Single-select: if already selected, deselect; otherwise select
    const updated = filters.gaul_2?.[0] === code ? [] : [code];
    handleChange('gaul_2', updated);
  };

  const handleSurveySelect = (assetId: string) => {
    // Single-select: if already selected, deselect; otherwise select
    const updated = filters.survey_id?.[0] === assetId ? [] : [assetId];
    handleChange('survey_id', updated);
  };

  // Server returns pre-filtered data based on user permissions
  // No client-side filtering needed - use data directly
  const filteredSurveys = surveys;
  const filteredDistricts = districts;

  // Validation
  const isPreviewDisabled = isLoading || loadingMetadata ||
    (!isAdmin && !user?.country?.length) || (isAdmin && !filters.country);

  return (
    <div>
      {/* Admin Only: Country Selector */}
      {isAdmin && (
        <div className="mb-3">
          <label className="form-label required">{t('filters.country')}</label>
          <select
            className="form-select"
            value={filters.country || ''}
            onChange={(e) => handleChange('country', e.target.value)}
            disabled={loadingMetadata}
          >
            <option value="">{t('filters.selectCountry')}</option>
            {countries.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <small className="form-hint">{t('filters.countryHint')}</small>
        </div>
      )}

      {/* Status Selector */}
      <div className="mb-3">
        <label className="form-label required">{t('filters.status')}</label>
        <select
          className="form-select"
          value={filters.status}
          onChange={(e) => handleChange('status', e.target.value as 'validated' | 'raw')}
        >
          <option value="validated">{t('filters.statusValidated')}</option>
          <option value="raw">{t('filters.statusRaw')}</option>
        </select>
        <small className="form-hint">{t('filters.statusHint')}</small>
      </div>

      {/* Scope Selector */}
      <div className="mb-3">
        <label className="form-label">{t('filters.scope')}</label>
        <select
          className="form-select"
          value={filters.scope || ''}
          onChange={(e) => handleChange('scope', e.target.value)}
        >
          <option value="">{t('filters.scopeAll')}</option>
          <option value="trip_info">{t('filters.scopeTripInfo')}</option>
          <option value="catch_info">{t('filters.scopeCatchInfo')}</option>
        </select>
        <small className="form-hint">{t('filters.scopeHint')}</small>
      </div>

      {/* Catch Taxon */}
      <div className="mb-3">
        <label className="form-label">{t('filters.catchTaxon')}</label>
        <input
          type="text"
          className="form-control"
          placeholder={t('filters.catchTaxonPlaceholder')}
          value={filters.catch_taxon || ''}
          onChange={(e) => handleChange('catch_taxon', e.target.value)}
        />
        <small className="form-hint">{t('filters.catchTaxonHint')}</small>
      </div>

      {/* Divider for advanced filters */}
      {(filteredSurveys.length > 0 || filteredDistricts.length > 0) && (
        <hr className="my-3" />
      )}

      {/* Surveys (Single-select) */}
      {filteredSurveys.length > 0 && (
        <div className="mb-3">

          <label className="form-label">{t('filters.surveys')}</label>
          <div className="form-selectgroup">
            {filteredSurveys.map(survey => (
              <label key={survey.asset_id} className="form-selectgroup-item">
                <input
                  type="radio"
                  name="survey_select"
                  className="form-selectgroup-input"
                  checked={filters.survey_id?.[0] === survey.asset_id || false}
                  onChange={() => handleSurveySelect(survey.asset_id)}
                />
                <span className="form-selectgroup-label">{survey.name}</span>
              </label>
            ))}
          </div>
          <small className="form-hint">{t('filters.surveysHint')}</small>
        </div>
      )}

      {/* GAUL Codes (Single-select) */}
      {filteredDistricts.length > 0 && (
        <div className="mb-3">
          <label className="form-label">{t('filters.gaulCodes')}</label>
          <div className="form-selectgroup">
            {filteredDistricts.map(district => (
              <label key={district.code} className="form-selectgroup-item">
                <input
                  type="radio"
                  name="gaul_select"
                  className="form-selectgroup-input"
                  checked={filters.gaul_2?.[0] === district.code || false}
                  onChange={() => handleGaulCodeSelect(district.code)}
                />
                <span className="form-selectgroup-label">{district.name}</span>
              </label>
            ))}
          </div>
          <small className="form-hint">{t('filters.gaulCodesHint')}</small>
        </div>
      )}

      {/* Warning for users with no country */}
      {!isAdmin && (!user?.country || user.country.length === 0) && (
        <div className="alert alert-warning mb-3">
          <IconInfoCircle className="icon me-2" />
          {t('filters.noCountryAssigned')}
        </div>
      )}

      {/* Warning for admin without country selection */}
      {isAdmin && !filters.country && (
        <div className="alert alert-info mb-3">
          <IconInfoCircle className="icon me-2" />
          {t('filters.selectCountryFirst')}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4">
        <button
          className="btn btn-primary w-100 mb-2"
          onClick={onPreview}
          disabled={isPreviewDisabled}
        >
          <IconSearch className="icon me-2" size={18} />
          {isLoading ? t('filters.loading') : t('filters.previewData')}
        </button>
        <button
          className="btn w-100"
          onClick={onReset}
          disabled={isLoading}
        >
          <IconX className="icon me-2" size={18} />
          {t('filters.resetFilters')}
        </button>
      </div>
    </div>
  );
};

export default DownloadFilters;
