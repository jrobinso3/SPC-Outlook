import { apiClient } from './client.js';
import { log } from '../logger.js';

/**
 * RadarService handles fetching WSR-88D NEXRAD station locations
 * and querying WMS capabilities for live radar imagery.
 */
export const RadarService = {
    // 24 hours TTL for fixed radar station positions
    STATIONS_TTL: 24 * 60 * 60 * 1000,
    // 2 minutes TTL for live WMS capabilities timestamps
    CAPABILITIES_TTL: 2 * 60 * 1000,

    /**
     * Fetches all active WSR-88D NEXRAD radar stations.
     */
    async fetchRadarStations() {
        const url = 'https://api.weather.gov/radar/stations';

        const data = await apiClient.get(url, {
            ttl: this.STATIONS_TTL
        });

        if (!data || !data.features) return [];

        return data.features
            .filter(f =>
                f.properties?.stationType === 'WSR-88D' &&
                f.geometry?.coordinates &&
                !isNaN(f.geometry.coordinates[0]) &&
                !isNaN(f.geometry.coordinates[1])
            )
            .map(f => ({
                id: f.properties.id,
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                city: f.properties.name || ''
            }));
    },

    /**
     * Finds the closest radar station to a given [lng, lat] coordinate.
     */
    findNearestStation(lng, lat, stationList) {
        if (!stationList || stationList.length === 0) return null;

        let minDistance = Infinity;
        let nearest = null;

        for (const site of stationList) {
            const dist = Math.pow(lng - site.lon, 2) + Math.pow(lat - site.lat, 2);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = site;
            }
        }

        return nearest;
    },

    /**
     * Fetches available WMS animation time steps for a station and product.
     */
    async fetchAvailableTimestamps(stationId, layerName) {
        const station = stationId.toLowerCase();
        const url = `https://opengeo.ncep.noaa.gov/geoserver/${station}/${layerName}/ows?service=WMS&request=GetCapabilities`;

        try {
            const text = await apiClient.get(url, {
                ttl: this.CAPABILITIES_TTL,
                responseType: 'text'
            });

            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const dimension = xml.querySelector('Dimension[name="time"]');
            if (!dimension) return [];
            return dimension.textContent.trim().split(',').map(s => s.trim()).filter(Boolean);
        } catch (err) {
            log.warn?.('Radar', `Failed to fetch WMS capabilities for ${station}:`, err.message);
            return [];
        }
    }
};
