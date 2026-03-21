/** Public support inbox for the login page (mailto). Not a secret. */
export const SUPPORT_EMAIL = 'peskas.platform@gmail.com' as const;

export function getSupportMailtoHref(): string {
  const query = new URLSearchParams({
    subject: 'PeSKAS validation portal – support request'
  });
  return `mailto:${SUPPORT_EMAIL}?${query.toString()}`;
}
