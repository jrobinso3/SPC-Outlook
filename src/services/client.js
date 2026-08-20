import { log } from '../logger.js';

/**
 * Intelligent HTTP Client with in-flight request deduplication,
 * TTL memory caching, ETag/If-Modified-Since conditional revalidation,
 * and stale-while-revalidate fallback.
 */
class ApiClient {
    constructor() {
        this.cache = new Map(); // key -> { data, timestamp, ttl, etag, lastModified }
        this.inFlight = new Map(); // key -> Promise
    }

    /**
     * Executes a fetch with in-flight deduplication and TTL caching.
     * @param {string} url - Target URL
     * @param {Object} options - Fetch options and caching config
     * @param {number} [options.ttl=300000] - Cache TTL in milliseconds (default: 5 min)
     * @param {boolean} [options.forceRefresh=false] - Bypass cache read (will still update cache)
     * @param {string} [options.responseType='json'] - 'json' | 'text'
     * @param {Object} [options.headers={}] - Custom headers
     */
    async get(url, options = {}) {
        const {
            ttl = 300000,
            forceRefresh = false,
            responseType = 'json',
            headers = {}
        } = options;

        const cacheKey = `${responseType}:${url}`;
        const now = Date.now();

        // 1. Return fresh cached response if available
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey);
            if (now - entry.timestamp < entry.ttl) {
                log.api?.(`Cache HIT (${Math.round((now - entry.timestamp) / 1000)}s old): ${url}`);
                return entry.data;
            }
        }

        // 2. In-flight request deduplication: merge simultaneous identical requests
        if (this.inFlight.has(cacheKey)) {
            log.api?.(`Joining in-flight request: ${url}`);
            return this.inFlight.get(cacheKey);
        }

        // 3. Initiate network request
        const requestPromise = (async () => {
            try {
                const reqHeaders = {
                    'User-Agent': 'SPC-Outlook-Dashboard (github.com/jrobinso3/SPC-Outlook)',
                    ...headers
                };

                // Add conditional HTTP headers if cached entry exists
                const existingEntry = this.cache.get(cacheKey);
                if (existingEntry) {
                    if (existingEntry.etag) {
                        reqHeaders['If-None-Match'] = existingEntry.etag;
                    }
                    if (existingEntry.lastModified) {
                        reqHeaders['If-Modified-Since'] = existingEntry.lastModified;
                    }
                }

                const startTime = performance.now();
                const response = await fetch(url, { headers: reqHeaders });
                const duration = Math.round(performance.now() - startTime);

                // Handle 304 Not Modified: return cached data with refreshed timestamp
                if (response.status === 304 && existingEntry) {
                    log.api?.(`HTTP 304 Not Modified in ${duration}ms: ${url}`);
                    existingEntry.timestamp = Date.now();
                    existingEntry.ttl = ttl;
                    return existingEntry.data;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText}`);
                }

                let data;
                if (responseType === 'json') {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                // Extract cache metadata
                const etag = response.headers.get('ETag') || null;
                const lastModified = response.headers.get('Last-Modified') || null;

                // Store in memory cache
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now(),
                    ttl,
                    etag,
                    lastModified
                });

                log.api?.(`Network fetch completed [${response.status}] in ${duration}ms: ${url}`);
                return data;

            } catch (err) {
                // If network fails and we have stale cached data, return it as fallback
                const staleEntry = this.cache.get(cacheKey);
                if (staleEntry) {
                    log.warn?.('API', `Network error for ${url}, returning stale cached data:`, err.message);
                    return staleEntry.data;
                }
                log.error?.('API', `Request failed for ${url}:`, err);
                throw err;
            } finally {
                this.inFlight.delete(cacheKey);
            }
        })();

        this.inFlight.set(cacheKey, requestPromise);
        return requestPromise;
    }

    /**
     * Clears all or specific cached entries.
     */
    clearCache(urlPattern = null) {
        if (!urlPattern) {
            this.cache.clear();
            return;
        }
        for (const key of this.cache.keys()) {
            if (key.includes(urlPattern)) {
                this.cache.delete(key);
            }
        }
    }
}

export const apiClient = new ApiClient();
