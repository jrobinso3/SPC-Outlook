import { state, saveAppState } from './state.js';
import { CONFIG } from './config.js';

export async function fetchRadarSites() {
    try {
        const response = await fetch('https://api.weather.gov/radar/stations', {
            headers: { 'User-Agent': 'SPC-Outlook-Dashboard (github.com/jrobinso3/SPC-Outlook)' }
        });
        const data = await response.json();
        
        state.radarSites = data.features
            .filter(f => f.properties.stationType === 'WSR-88D')
            .map(f => ({
                id: f.properties.id,
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                city: f.properties.name
            }));

        initRadarMarkers();
        
        if (state.showRadar) {
            if (state.activeRadarId) {
                loadRadar(state.activeRadarId);
            } else {
                findNearestRadar(true);
            }
        }
    } catch (error) {
        console.error('Error fetching radar sites:', error);
    }
}

export function initRadarMarkers() {
    if (!state.radarSitesLayer) {
        state.radarSitesLayer = L.layerGroup();
    }
    
    state.radarSitesLayer.clearLayers();
    
    state.radarSites.forEach(site => {
        const icon = L.divIcon({
            className: 'radar-site-label',
            html: `<span>${site.id}</span>`,
            iconSize: [40, 20],
            iconAnchor: [20, 10]
        });
        
        const marker = L.marker([site.lat, site.lon], { 
            icon: icon,
            stationId: site.id 
        });
        marker.on('click', () => loadRadar(site.id));
        marker.bindTooltip(`${site.id} - ${site.city}`, { direction: 'top', offset: [0, -10] });
        state.radarSitesLayer.addLayer(marker);
    });
}

export function loadRadar(stationId, isHeartbeat = false) {
    if (!state.showRadar) return;

    const station = stationId.toLowerCase();
    const layerName = `${station}_${state.currentRadarProduct}`;
    const timestamp = Date.now();
    
    if (!isHeartbeat && state.activeRadarId === stationId && state.activeRadarLayer?.options?.layers === layerName) {
        return;
    }

    if (state.pendingRadarLayer) {
        state.map.removeLayer(state.pendingRadarLayer);
        state.pendingRadarLayer = null;
    }
    
    state.pendingRadarLayer = L.tileLayer.wms(`https://opengeo.ncep.noaa.gov/geoserver/${station}/${layerName}/ows`, {
        layers: layerName,
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
        pane: 'radarPane',
        opacity: 0.8,
        attribution: 'NOAA/NWS',
        _cb: timestamp
    });

    state.pendingRadarLayer.on('load', function() {
        if (this !== state.pendingRadarLayer) return;

        if (state.activeRadarLayer) {
            state.map.removeLayer(state.activeRadarLayer);
        }
        state.activeRadarLayer = this;
        state.activeRadarId = stationId;
        state.pendingRadarLayer = null;
        
        // Update UI indicator
        const radarLabel = document.querySelector('.radar-site-label.active-radar');
        if (radarLabel) {
            radarLabel.classList.add('synced');
            setTimeout(() => radarLabel.classList.remove('synced'), 1000);
        }
    });

    state.pendingRadarLayer.addTo(state.map);
    
    if (state.radarSitesLayer) {
        state.radarSitesLayer.eachLayer(marker => {
            if (marker.options.stationId === stationId) {
                marker.getElement()?.classList.add('active-radar');
            } else {
                marker.getElement()?.classList.remove('active-radar');
            }
        });
    }
}

export function findNearestRadar(force = false) {
    if (!state.activeRadarId && !force) return;

    const center = state.map.getCenter();
    let minDistance = Infinity;
    let nearestSite = null;

    state.radarSites.forEach(site => {
        const dist = state.map.distance(center, [site.lat, site.lon]);
        if (dist < minDistance) {
            minDistance = dist;
            nearestSite = site;
        }
    });

    if (nearestSite && nearestSite.id !== state.activeRadarId) {
        loadRadar(nearestSite.id);
    }
}
