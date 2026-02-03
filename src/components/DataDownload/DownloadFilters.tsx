import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconSearch, IconX, IconInfoCircle, IconExternalLink } from '@tabler/icons-react';
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
  // Pass selected survey to enable cascade filtering (Country → Survey → Districts)
  const { metadata, isLoading: loadingMetadata } = useFetchDownloadMetadata(
    isAdmin ? filters.country : undefined,
    filters.survey_id?.[0] // Pass selected survey for district filtering
  );
  const { countries, districts, surveys } = metadata;

  const handleChange = (field: keyof FiltersType, value: any) => {
    // CASCADE: Country → Survey → Districts
    if (field === 'country') {
      // Reset survey and GAUL selections when country changes
      setFilters({ ...filters, [field]: value, survey_id: [], gaul_2: '' });
    } else if (field === 'survey_id') {
      // Reset GAUL selection when survey changes (districts will be filtered by survey)
      setFilters({ ...filters, [field]: value, gaul_2: '' });
    } else {
      setFilters({ ...filters, [field]: value });
    }
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
          <small className="form-hint">
            {t('filters.countryHint')}{' '}
          </small>
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
        <small className="form-hint">
          {t('filters.statusHint')}{' '}
        </small>
      </div>

      {/* Scope Selector */}
      <div className="mb-3">
        <label className="form-label">{t('filters.scope')}</label>
        <select
          className="form-select"
          value={filters.scope || ''}
          onChange={(e) => handleChange('scope', e.target.value)}
        >
          <optgroup label={t('filters.scopeGroupDefault')}>
            <option value="">{t('filters.scopeAll')}</option>
          </optgroup>
          <optgroup label={t('filters.scopeGroupFiltered')}>
            <option value="trip_info">{t('filters.scopeTripInfo')}</option>
            <option value="catch_info">{t('filters.scopeCatchInfo')}</option>
          </optgroup>
        </select>
        <small className="form-hint">
          {t('filters.scopeHint')}{' '}
        </small>
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
        <small 
          className="form-hint"
          dangerouslySetInnerHTML={{ __html: t('filters.catchTaxonHint') }}
        />
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

      {/* GAUL Codes (Single-select Dropdown) */}
      {(isAdmin || filteredDistricts.length > 0) && (
        <div className="mb-3">
          <label className="form-label">{t('filters.gaulCodes')}</label>
          <select
            className="form-select"
            value={filters.gaul_2 || ''}
            onChange={(e) => handleChange('gaul_2', e.target.value)}
            disabled={loadingMetadata || (isAdmin && !filters.country) || (isAdmin && filteredSurveys.length > 0 && filters.survey_id?.length === 0) || filteredDistricts.length === 0}
          >
            <optgroup label={t('filters.gaulGroupAll')}>
              <option value="">{t('filters.gaulAll')}</option>
            </optgroup>
            {filteredDistricts.length > 0 && (
              <optgroup label={t('filters.gaulGroupDistricts')}>
                {filteredDistricts.map(district => (
                  <option key={district.code} value={district.code}>
                    {district.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <small className="form-hint">
            {loadingMetadata ? t('filters.loading') : (
              <>
                {isAdmin && !filters.country ? (
                  'Select a country first'
                ) : isAdmin && filteredSurveys.length > 0 && (!filters.survey_id || filters.survey_id.length === 0) ? (
                  'Select a survey to see available districts'
                ) : filteredDistricts.length === 0 && filters.survey_id && filters.survey_id.length > 0 ? (
                  'No districts available for selected survey'
                ) : (
                  <>
                    {t('filters.gaulCodesHint')}{' '}
                    <a href={t('filters.gaulHelpLink')} target="_blank" rel="noopener noreferrer" className="link-secondary">
                      <IconExternalLink className="icon icon-inline" size={14} />
                      {t('common.learnMore')}
                    </a>
                  </>
                )}
              </>
            )}
          </small>
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
