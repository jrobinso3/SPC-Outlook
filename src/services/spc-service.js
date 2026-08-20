import { apiClient } from './client.js';
import { CONFIG } from '../config.js';
import { cleanDiscussionText } from '../utils.js';
import { log } from '../logger.js';

/**
 * SPCService handles all interactions with NOAA Storm Prediction Center
 * convective outlooks, probabilistic layers, and technical discussions.
 */
export const SPCService = {
    // 5 minutes TTL for outlook GeoJSON layers
    OUTLOOK_TTL: 5 * 60 * 1000,
    // 15 minutes TTL for technical discussion texts
    DISCUSSION_TTL: 15 * 60 * 1000,

    /**
     * Fetches and normalizes SPC Outlook GeoJSON.
     * @param {number} layerId - ArcGIS layer index (e.g. 1, 3, 5)
     * @param {boolean} [forceRefresh=false]
     */
    async fetchOutlook(layerId, forceRefresh = false) {
        const url = `${CONFIG.apiBase}/${layerId}/query?where=1%3D1&outFields=*&f=geojson`;
        
        const data = await apiClient.get(url, {
            ttl: this.OUTLOOK_TTL,
            forceRefresh
        });

        if (!data || !data.features) return null;

        // Clone and normalize features
        const features = data.features.map(f => this.normalizeOutlookFeature(f));
        return { ...data, features };
    },

    /**
     * Fetches and normalizes Significant (SIG / CIG) intensity contours.
     * @param {number} sigLayerId - ArcGIS SIG layer index
     * @param {boolean} [forceRefresh=false]
     */
    async fetchSigData(sigLayerId, forceRefresh = false) {
        const url = `${CONFIG.apiBase}/${sigLayerId}/query?where=label+IN+('CIG1','CIG2','CIG3')&outFields=*&f=geojson`;
        
        const data = await apiClient.get(url, {
            ttl: this.OUTLOOK_TTL,
            forceRefresh
        });

        if (!data || !data.features) return null;

        const features = data.features.map(f => this.normalizeOutlookFeature(f));
        return { ...data, features };
    },

    /**
     * Fetches and cleans technical discussion text.
     * @param {string} productType - 'day1', 'day2', 'day3', 'day48'
     * @param {string} baseDateStr - Reference date string for timezone conversion
     */
    async fetchDiscussion(productType, baseDateStr) {
        const targetUrl = `${CONFIG.discussionBase}/${productType}otlk.html`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

        let html = '';
        try {
            html = await apiClient.get(targetUrl, {
                ttl: this.DISCUSSION_TTL,
                responseType: 'text'
            });
        } catch (e) {
            log.warn?.('Outlooks', 'Direct discussion fetch failed, falling back to proxy:', e.message);
            html = await apiClient.get(proxyUrl, {
                ttl: this.DISCUSSION_TTL,
                responseType: 'text'
            });
        }

        if (!html) throw new Error('Empty response from discussion source');

        const pre = new DOMParser().parseFromString(html, 'text/html').querySelector('pre');
        if (pre) {
            return cleanDiscussionText(pre.innerText, baseDateStr);
        }
        return null;
    },

    /**
     * Normalizes feature properties (converts decimal labels like 0.15 to '15%').
     */
    normalizeOutlookFeature(feature) {
        const p = feature.properties || {};
        const normalized = {
            ...p,
            label: (p.label || p.LABEL || '').toUpperCase(),
            label2: p.label2 || p.LABEL_2 || 'Convective Outlook Area',
            valid: p.valid || p.VALID || 'N/A',
            expire: p.expire || p.EXPIRE || 'N/A',
            issue: p.issue || p.ISSUE || 'N/A'
        };

        const l = normalized.label;
        if (l && !isNaN(l)) {
            const val = parseFloat(l);
            if (val > 0 && val < 1) {
                normalized.displayLabel = Math.round(val * 100) + '%';
            } else if (val >= 1) {
                normalized.displayLabel = val + '%';
            } else {
                normalized.displayLabel = l;
            }
        } else {
            normalized.displayLabel = l;
        }

        return {
            ...feature,
            properties: normalized
        };
    }
};
