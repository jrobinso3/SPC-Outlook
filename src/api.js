import { SPCService } from './services/spc-service.js';
import { AlertsService } from './services/alerts-service.js';
import { RadarService } from './services/radar-service.js';
import { apiClient } from './services/client.js';

export { SPCService, AlertsService, RadarService, apiClient };

/**
 * DataProvider provides backward compatibility for existing callers,
 * delegating to dedicated services with smart caching and deduplication.
 */
export const DataProvider = {
    fetchOutlook(layerId, forceRefresh = false) {
        return SPCService.fetchOutlook(layerId, forceRefresh);
    },

    fetchSigData(sigLayerId, forceRefresh = false) {
        return SPCService.fetchSigData(sigLayerId, forceRefresh);
    },

    fetchWatchPolygons(forceRefresh = false) {
        return AlertsService.fetchWatchPolygons(forceRefresh);
    },

    normalizeOutlookFeature(feature) {
        return SPCService.normalizeOutlookFeature(feature);
    }
};
