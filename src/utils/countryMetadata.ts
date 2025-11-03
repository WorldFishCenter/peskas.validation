// Country metadata for multi-country support

export interface CountryMetadata {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
}

// Country metadata mapping
export const COUNTRY_METADATA: Record<string, CountryMetadata> = {
  'tz': {
    code: 'tz',
    name: 'Tanzania',
    flag: '🇹🇿',
    currency: 'TZS',
    currencySymbol: 'TSh',
  },
  'zm': {
    code: 'zm',
    name: 'Zambia',
    flag: '🇿🇲',
    currency: 'ZMW',
    currencySymbol: 'ZK',
  },
  'mw': {
    code: 'mw',
    name: 'Malawi',
    flag: '🇲🇼',
    currency: 'MWK',
    currencySymbol: 'MK',
  },
  'ke': {
    code: 'ke',
    name: 'Kenya',
    flag: '🇰🇪',
    currency: 'KES',
    currencySymbol: 'KSh',
  },
};

/**
 * Get country metadata by country code
 */
export const getCountryMetadata = (countryCode: string | undefined): CountryMetadata | null => {
  if (!countryCode) return null;
  return COUNTRY_METADATA[countryCode.toLowerCase()] || null;
};

/**
 * Get country flag emoji
 */
export const getCountryFlag = (countryCode: string | undefined): string => {
  const metadata = getCountryMetadata(countryCode);
  return metadata?.flag || '';
};

/**
 * Get country name
 */
export const getCountryName = (countryCode: string | undefined): string => {
  const metadata = getCountryMetadata(countryCode);
  return metadata?.name || countryCode?.toUpperCase() || '';
};

/**
 * Get all available countries
 */
export const getAllCountries = (): CountryMetadata[] => {
  return Object.values(COUNTRY_METADATA);
};
