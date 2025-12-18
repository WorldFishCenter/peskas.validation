/**
 * TypeScript type definitions for i18next
 *
 * This file enables type-safe translations with autocomplete for translation keys.
 * Import translation JSON files to infer types from actual translation structure.
 */

import 'react-i18next';

// Import English translations as the source of truth for types
import common from '../../public/locales/en/common.json';

// Extend react-i18next module to add custom type options
declare module 'react-i18next' {
  interface CustomTypeOptions {
    // Set default namespace
    defaultNS: 'common';

    // Define resources for type checking
    // Add more namespaces here as they are created
    resources: {
      common: typeof common;
      // navigation: typeof navigation;
      // auth: typeof auth;
      // validation: typeof validation;
      // enumerators: typeof enumerators;
      // admin: typeof admin;
      // guide: typeof guide;
      // errors: typeof errors;
    };

    // Return type for t function (string by default)
    returnNull: false;
  }
}

export {};
