import { apiClient } from './client.js';
import { CONFIG } from '../config.js';
import { log } from '../logger.js';

/**
 * AlertsService handles fetching and dissolving active NWS Warnings and Watches
 * with conditional caching and change detection.
 */
export const AlertsService = {
    WARNINGS_TTL: 45 * 1000, // 45 seconds polling TTL
    WATCHES_TTL: 60 * 1000,  // 60 seconds watch TTL

    /**
     * Fetches active warnings from NWS API.
     * @param {boolean} [forceRefresh=false]
     */
    async fetchActiveWarnings(forceRefresh = false) {
        const events = [
            'Tornado Warning',
            'Tornado Watch',
            'Severe Thunderstorm Warning',
            'Severe Thunderstorm Watch',
            'Severe Weather Statement'
        ];
        const params = new URLSearchParams({
            event: events.join(','),
            status: 'actual'
        });
        const url = `${CONFIG.alertsApi}?${params.toString()}`;

        const data = await apiClient.get(url, {
            ttl: this.WARNINGS_TTL,
            forceRefresh
        });

        if (!data || !data.features) return [];

        // Filter for active warning events
        return data.features.filter(f => f.properties?.event && f.properties.event.includes('Warning'));
    },

    /**
     * Fetches and dissolves active NWS Watch polygons from ArcGIS REST API.
     * @param {boolean} [forceRefresh=false]
     */
    async fetchWatchPolygons(forceRefresh = false) {
        const where = encodeURIComponent("Event LIKE '%Thunderstorm Watch%' OR Event LIKE '%Tornado Watch%'");
        const url = `${CONFIG.watchPolygonsApi}/query?where=${where}&outFields=Event,Summary,End_,Description,Instruction&f=geojson`;

        const data = await apiClient.get(url, {
            ttl: this.WATCHES_TTL,
            forceRefresh
        });

        if (!data || !data.features || data.features.length === 0) {
            return { type: 'FeatureCollection', features: [] };
        }

        // Group sub-features by SPC watch number
        const watchGroups = {};
        data.features.forEach(f => {
            const desc = f.properties?.Description || '';
            const match = desc.match(/(?:TORNADO|SEVERE THUNDERSTORM)\s+WATCH\s+(\d+)/i);
            const watchKey = match ? `${f.properties.Event}_${match[1]}` : `${f.properties.Event}_${f.properties.End_}`;

            if (!watchGroups[watchKey]) {
                watchGroups[watchKey] = { representative: f, features: [] };
            }
            watchGroups[watchKey].features.push(f);
        });

        // Re-emit one normalized feature per SPC watch with geometry union
        const mergedFeatures = Object.values(watchGroups).map(({ representative, features }) => {
            const p = representative.properties || {};
            const desc = p.Description || '';
            const numMatch = desc.match(/(?:TORNADO|SEVERE THUNDERSTORM)\s+WATCH\s+(\d+)/i);
            const watchNum = numMatch ? numMatch[1] : '';

            let geometry = representative.geometry;
            if (typeof window !== 'undefined' && typeof window.turf !== 'undefined') {
                try {
                    const turf = window.turf;
                    const BUFFER_KM = 0.5;
                    const buffered = features.map(f => turf.buffer(f, BUFFER_KM, { units: 'kilometers' })).filter(Boolean);
                    const merged = buffered.length >= 2
                        ? turf.union(turf.featureCollection(buffered))
                        : (buffered[0] || features[0]);
                    const dissolved = merged ? turf.buffer(merged, -BUFFER_KM, { units: 'kilometers' }) : null;
                    if (dissolved?.geometry) geometry = dissolved.geometry;
                } catch (err) {
                    log.warn?.('Alerts', 'Turf geometry dissolve fallback:', err.message);
                }
            }

            return {
                type: 'Feature',
                geometry,
                properties: {
                    event: p.Event,
                    headline: `${p.Event}${watchNum ? ' #' + watchNum : ''}`,
                    description: desc,
                    expires: p.End_ ? new Date(p.End_).toISOString() : null,
                    instruction: p.Instruction || ''
                }
            };
        });

        return { type: 'FeatureCollection', features: mergedFeatures };
    },

    /**
     * Checks if warning list has changed by comparing ID and timestamp signatures.
     */
    hasWarningsChanged(newWarnings, oldWarnings) {
        if (!oldWarnings || newWarnings.length !== oldWarnings.length) return true;
        const oldSig = oldWarnings.map(w => `${w.id || w.properties?.id}_${w.properties?.expires}`).sort().join('|');
        const newSig = newWarnings.map(w => `${w.id || w.properties?.id}_${w.properties?.expires}`).sort().join('|');
        return oldSig !== newSig;
    }
};
