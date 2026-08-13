import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Flat config, replacing `.eslintrc.json`. ESLint 8 reached end of life in October 2024 and the
 * eslintrc format is no longer the default.
 *
 * The rule set is deliberately the same one the project already ran at `--max-warnings 0`; this
 * is a format migration, not a tightening. Keep it that way — raising strictness here and fixing
 * the fallout are separate changes.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'data-explorer/',
      'public/data-explorer/',
      'graphify-out/'
    ]
  },

  // Plain JavaScript: the serverless handlers, lib/ and the Airtable sync scripts.
  {
    files: ['**/*.{js,cjs,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      ...js.configs.recommended.rules,
      // `caughtErrors` defaults to 'all' in ESLint 9 (it was 'none' in 8), so a deliberately
      // ignored catch binding needs the same underscore opt-out arguments already had.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unreachable': 'error',
      'no-undef': 'error'
    }
  },

  // The backend and the sync scripts log to stdout on purpose — that is their only output.
  {
    files: ['api/**/*.js', 'server/**/*.js', 'lib/**/*.js', 'scripts/**/*.{js,cjs}'],
    rules: { 'no-console': 'off' }
  },

  // TypeScript. `no-undef` stays off: the compiler already resolves identifiers, and the rule
  // reports false positives on type-only names.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
);
