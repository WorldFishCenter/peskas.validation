/**
 * Airtable API Rate Limiter
 * Ensures we don't exceed Airtable's 5 requests/second limit
 *
 * Features:
 * - Rate limiting (5 req/sec by default)
 * - Exponential backoff retry on 429 (rate limit) errors
 * - Automatic retry on network errors
 *
 * @module lib/airtable-rate-limiter
 */

/**
 * Rate Limiter
 *
 * Enforces rate limits by adding delays between API requests.
 * Prevents exceeding Airtable's API limits.
 */
class RateLimiter {
  /**
   * Create a new rate limiter
   *
   * @param {number} requestsPerSecond - Maximum requests per second (default: 5 for Airtable)
   */
  constructor(requestsPerSecond = 5) {
    this.requestsPerSecond = requestsPerSecond;
    this.delayMs = 1000 / requestsPerSecond; // 200ms for 5 req/sec
    this.lastRequestTime = 0;
  }

  /**
   * Wait if necessary to respect rate limit
   *
   * Call this before each API request to ensure rate limit compliance.
   */
  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.delayMs) {
      const waitTime = this.delayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

/**
 * Fetch with automatic retry on rate limit or network errors
 *
 * Wraps an async fetch function with retry logic using exponential backoff.
 *
 * @param {Function} fetchFunction - Async function that performs the fetch
 * @param {number} retries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<*>} Result from fetchFunction
 *
 * @example
 * const data = await fetchWithRetry(async () => {
 *   await rateLimiter.wait();
 *   return await axios.get(url);
 * }, 3);
 */
async function fetchWithRetry(fetchFunction, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchFunction();
    } catch (error) {
      // Check if we should retry
      const shouldRetry =
        error.response?.status === 429 || // Rate limit
        error.code === 'ECONNRESET' ||   // Connection reset
        error.code === 'ETIMEDOUT' ||    // Timeout
        error.code === 'ENOTFOUND';      // DNS error

      if (shouldRetry && attempt < retries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Request failed (${error.response?.status || error.code}), retrying in ${backoffMs}ms... (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      // No more retries or non-retryable error
      throw error;
    }
  }
}

// Create singleton rate limiter instance (5 req/sec for Airtable)
const rateLimiter = new RateLimiter(5);

module.exports = {
  RateLimiter,
  rateLimiter,
  fetchWithRetry
};
