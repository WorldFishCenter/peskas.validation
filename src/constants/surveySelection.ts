/**
 * Reasons the API resolved a request to no survey.
 *
 * Mirrors `lib/survey-selection.js`. These codes replaced two English sentences that the
 * browser compared verbatim — which meant a message shown to users could not be translated
 * without changing control flow here.
 */
export const SURVEY_REQUIRED = 'SURVEY_REQUIRED';
export const SURVEY_DENIED = 'SURVEY_DENIED';
