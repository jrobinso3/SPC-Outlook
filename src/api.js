import { fetchGeoJSON } from './utils.js';
import { CONFIG } from './config.js';
// Note: turf is available globally from index.html scripts

/**
 * DataProvider handles all communication with NOAA/ArcGIS APIs
 * and performs data normalization at the edge.
 */
export const DataProvider = {
    /**
     * Fetches and normalizes SPC Outlook data
     */
    async fetchOutlook(layerId) {
        const url = `${CONFIG.apiBase}/${layerId}/query?where=1%3D1&outFields=*&f=geojson`;
        const data = await fetchGeoJSON(url);
        
        if (!data || !data.features) return null;

        // Normalize features at the edge
        data.features = data.features.map(f => this.normalizeOutlookFeature(f));
        
        return data;
    },

    /**
     * Fetches and normalizes SIG (Intensity) data
     */
    async fetchSigData(layerId) {
        const url = `${CONFIG.apiBase}/${layerId}/query?where=label+IN+('CIG1','CIG2','CIG3')&outFields=*&f=geojson`;
        const data = await fetchGeoJSON(url);
        
        if (!data || !data.features) return null;
        
        data.features = data.features.map(f => this.normalizeOutlookFeature(f));
        
        return data;
    },

    /**
     * Fetches and dissolves NWS Watch polygons from ArcGIS
     */
    async fetchWatchPolygons() {
        const where = encodeURIComponent("Event LIKE '%Thunderstorm Watch%' OR Event LIKE '%Tornado Watch%'");
        const url = `${CONFIG.watchPolygonsApi}/query?where=${where}&outFields=Event,Summary,End_,Description,Instruction&f=geojson`;

        const data = await fetchGeoJSON(url);
        if (!data || !data.features) return { type: 'FeatureCollection', features: [] };

        // Group sub-features by SPC watch number
        const watchGroups = {};
        data.features.forEach(f => {
            const desc = f.properties.Description || '';
            const match = desc.match(/(?:TORNADO|SEVERE THUNDERSTORM)\s+WATCH\s+(\d+)/i);
            const watchKey = match ? `${f.properties.Event}_${match[1]}` : `${f.properties.Event}_${f.properties.End_}`;

            if (!watchGroups[watchKey]) {
                watchGroups[watchKey] = { representative: f, features: [] };
            }
            watchGroups[watchKey].features.push(f);
        });

        // Re-emit one normalized feature per SPC watch
        const mergedFeatures = Object.values(watchGroups).map(({ representative, features }) => {
            const p = representative.properties;
            const desc = p.Description || '';
            const numMatch = desc.match(/(?:TORNADO|SEVERE THUNDERSTORM)\s+WATCH\s+(\d+)/i);
            const watchNum = numMatch ? numMatch[1] : '';

            // Dissolve sub-features using buffer → union → unbuffer
            const BUFFER_KM = 0.5;
            const buffered = features.map(f => turf.buffer(f, BUFFER_KM, { units: 'kilometers' })).filter(Boolean);
            const merged = buffered.length >= 2
                ? turf.union(turf.featureCollection(buffered))
                : (buffered[0] || features[0]);
            const dissolved = merged ? turf.buffer(merged, -BUFFER_KM, { units: 'kilometers' }) : null;
            const geometry = dissolved ? dissolved.geometry : representative.geometry;

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
     * Normalizes feature properties (label conversion, key casing, etc.)
     */
    normalizeOutlookFeature(feature) {
        const p = feature.properties;
        const normalized = {
            ...p,
            label: (p.label || p.LABEL || '').toUpperCase(),
            label2: p.label2 || p.LABEL_2 || 'Convective Outlook Area',
            valid: p.valid || p.VALID || 'N/A',
            expire: p.expire || p.EXPIRE || 'N/A',
            issue: p.issue || p.ISSUE || 'N/A'
        };

        // Convert decimals/raw numbers to percentage strings (e.g. 0.15 -> 15%)
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

        feature.properties = normalized;
        return feature;
    }
};
