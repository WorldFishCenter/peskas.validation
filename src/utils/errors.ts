/**
 * Turn a thrown value into a message safe to show a user.
 *
 * Reading `err.response.data.error` directly is the trap this exists to close: a Vercel
 * gateway error puts an object `{ code, message }` there rather than a string, which renders
 * as "[object Object]". Every catch block in the app funnels through here so that shape is
 * handled in exactly one place.
 *
 * @param err - The caught value. Typed `unknown` because a catch block can receive anything.
 * @param fallback - Message to use when nothing usable can be extracted.
 */
export const extractErrorMessage = (err: unknown, fallback: string): string => {
  if (typeof err !== 'object' || err === null) {
    return fallback;
  }

  const raw = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;

  if (typeof raw === 'string' && raw.trim()) {
    return raw;
  }

  if (typeof raw === 'object' && raw !== null) {
    const message = (raw as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
};

/**
 * HTTP status code of a failed request, when the error carries one.
 *
 * @param err - The caught value
 * @returns The status code, or undefined if the error is not an HTTP response error
 */
export const errorStatus = (err: unknown): number | undefined => {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }
  const status = (err as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' ? status : undefined;
};
