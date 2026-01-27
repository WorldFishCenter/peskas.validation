/**
 * Type definitions for Data Download feature
 *
 * This module defines TypeScript interfaces for the data download functionality,
 * including filters, API responses, and component props.
 */

/**
 * Filter parameters for data download
 */
export interface DownloadFilters {
  /** Country identifier (e.g., 'zanzibar', 'mozambique') - Admin only, pre-filled for regular users */
  country?: string;

  /** Array of survey IDs (asset_ids) - filtered by user permissions */
  survey_id?: string[];

  /** GAUL level 2 administrative code (single selection) */
  gaul_2?: string;

  /** Data validation status */
  status: 'validated' | 'raw';

  /** FAO ASFIS species code (optional) */
  catch_taxon?: string;

  /** Data scope - trip information, catch information, or all data (optional) */
  scope?: 'trip_info' | 'catch_info' | '';
}

/**
 * Preview data response from API
 */
export interface PreviewData {
  /** Array of data rows (dynamic schema) */
  data: Record<string, any>[];

  /** Total number of rows available */
  total_count: number;

  /** Filters that were actually applied (after permission filtering) */
  filters_applied: DownloadFilters;
}

/**
 * Error response structure
 */
export interface DownloadError {
  /** Error message */
  message: string;

  /** Error code (optional) */
  code?: string;
}

/**
 * GAUL code with metadata
 */
export interface GaulCode {
  /** GAUL code identifier */
  code: string;

  /** Human-readable name */
  name: string;

  /** Associated country code */
  country: string;
}

/**
 * Country option for dropdown
 */
export interface CountryOption {
  /** Country code (e.g., 'zanzibar') */
  code: string;

  /** Display name */
  name: string;
}

/**
 * District (GAUL Level 2) option for dropdown
 */
export interface District {
  /** GAUL Level 2 code */
  code: string;

  /** District name */
  name: string;

  /** Associated country code */
  country: string | null;
}

/**
 * Survey option for dropdown
 */
export interface Survey {
  /** KoboToolbox asset ID */
  asset_id: string;

  /** Survey name */
  name: string;

  /** Associated country code */
  country_id: string;

  /** Whether survey is active */
  active: boolean;
}

/**
 * API response for preview endpoint
 */
export interface PreviewResponse {
  success: boolean;
  data: Record<string, any>[];
  total_count: number;
  filters_applied: DownloadFilters;
}

/**
 * Download status
 */
export type DownloadStatus = 'idle' | 'previewing' | 'downloading' | 'success' | 'error';

/**
 * Field description from PeSKAS API metadata
 *
 * Comprehensive documentation for a single data field including type,
 * unit, examples, and semantic information.
 *
 * Based on: https://github.com/WorldFishCenter/peskas-api/blob/main/src/peskas_api/schema/field_metadata.py
 */
export interface FieldDescription {
  /** Field identifier */
  name?: string;

  /** Human-readable description explaining what this field represents */
  description: string;

  /** Data type: 'string', 'integer', 'float', 'date', 'datetime' */
  data_type?: string;

  /** Unit of measurement (e.g., 'kg', 'cm', 'hours', 'meters') */
  unit?: string;

  /** Sample data instances (array of examples) */
  examples?: any[];

  /** Enumerated categorical options (possible values) */
  possible_values?: string[];

  /** Numeric min/max bounds (tuple: [min, max]) */
  value_range?: [number | null, number | null] | null;

  /** Whether field is mandatory */
  required?: boolean;

  /** Formal ontology definition URL for semantic web interoperability */
  ontology_url?: string;

  /** Documentation or dataset catalog links */
  url?: string;
}

/**
 * Field metadata response from API
 *
 * Contains metadata for all fields in the landings dataset,
 * optionally filtered by scope (trip_info or catch_info).
 */
export interface FieldMetadata {
  /** Map of field names to their descriptions */
  fields: Record<string, FieldDescription>;

  /** The scope filter applied (if any) */
  scope?: string;

  /** Optional message (e.g., when metadata is unavailable) */
  message?: string;
}
