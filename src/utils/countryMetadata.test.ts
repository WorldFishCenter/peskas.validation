// Run with: npx tsx src/utils/countryMetadata.test.ts
import assert from 'node:assert/strict';
import { getCountryFlag, getCountryName, getCountryMetadata } from './countryMetadata';

// The four deployed countries, as `surveys.country_id` actually stores them
// (Airtable "Associated Countries" display names).
for (const [countryId, name, flag] of [
  ['Zanzibar', 'Zanzibar', '🇹🇿'],
  ['Mozambique', 'Mozambique', '🇲🇿'],
  ['Timor', 'Timor-Leste', '🇹🇱'],
  ['Kenya', 'Kenya', '🇰🇪'],
] as const) {
  assert.equal(getCountryName(countryId), name, `name for ${countryId}`);
  assert.equal(getCountryFlag(countryId), flag, `flag for ${countryId}`);
}

// Lowercase slugs (countries.code / districts.country_id) hit the same entries.
assert.equal(getCountryFlag('zanzibar'), '🇹🇿');
assert.equal(getCountryName('mozambique'), 'Mozambique');

// Airtable has already renamed Timor → "Timor-Leste" in both the countries and forms tables,
// so the next survey sync will rewrite surveys.country_id. Every spelling must land on the same
// entry, or that rename silently costs Timor its flag and name.
for (const spelling of ['Timor', 'Timor-Leste', 'timor-leste', 'timor leste', 'TIMOR-LESTE', '  Timor-Leste  ']) {
  assert.equal(getCountryName(spelling), 'Timor-Leste', `name for ${spelling}`);
  assert.equal(getCountryFlag(spelling), '🇹🇱', `flag for ${spelling}`);
}

// Airtable sometimes yields a single-element array; must not throw.
assert.equal(getCountryFlag(['Kenya'] as unknown as string), '🇰🇪');

// Unknown and empty inputs degrade, never throw.
assert.equal(getCountryMetadata('atlantis'), null);
assert.equal(getCountryFlag('atlantis'), '');
assert.equal(getCountryName('atlantis'), 'ATLANTIS');
assert.equal(getCountryName(undefined), '');
assert.equal(getCountryFlag(undefined), '');

console.log('countryMetadata: all assertions passed');
