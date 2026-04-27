import { state, saveAppState } from './state.js';
import { CONFIG } from './config.js';
import { stopAnimation, animationState, toggleRadarAnimation } from './radar-animation.js';
import { getLayerAnchor } from './map.js';

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
    const map = state.map;
    if (!map) return;

    if (map.getLayer('radar-sites')) map.removeLayer('radar-sites');
    if (map.getSource('radar-sites-src')) map.removeSource('radar-sites-src');

    const geojson = {
        type: 'FeatureCollection',
        features: state.radarSites.map(site => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [site.lon, site.lat] },
            properties: { id: site.id, city: site.city }
        }))
    };

    map.addSource('radar-sites-src', { type: 'geojson', data: geojson });

    map.addLayer({
        id: 'radar-sites',
        type: 'symbol',
        source: 'radar-sites-src',
        layout: {
            'text-field': ['get', 'id'],
            'text-size': 10,
            'text-allow-overlap': false
        },
        paint: {
            'text-color': '#94a3b8',
            'text-halo-color': '#020617',
            'text-halo-width': 1
        }
    });
}

export function loadRadar(stationId, isHeartbeat = false) {
    const map = state.map;
    if (!map || !state.showRadar) return;

    const wasAnimating = animationState.isPlaying;
    stopAnimation(true);

    const station = stationId.toLowerCase();
    const layerName = `${station}_${state.currentRadarProduct}`;
    
    // Remove existing radar layers
    if (map.getLayer('radar-raster')) map.removeLayer('radar-raster');
    if (map.getSource('radar-src')) map.removeSource('radar-src');

    const beforeId = getLayerAnchor('radar');

    // Formulate WMS URL for MapLibre
    const wmsUrl = `https://opengeo.ncep.noaa.gov/geoserver/${station}/${layerName}/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layerName}&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=256&HEIGHT=256&CRS=EPSG:3857&BBOX={bbox-epsg-3857}`;

    map.addSource('radar-src', {
        type: 'raster',
        tiles: [wmsUrl],
        tileSize: 256
    });

    map.addLayer({
        id: 'radar-raster',
        type: 'raster',
        source: 'radar-src',
        paint: { 'raster-opacity': 0.8 }
    }, beforeId);

    state.activeRadarId = stationId;

    if (wasAnimating) toggleRadarAnimation();

    // Update UI Panel
    const stationEl = document.getElementById('radar-station-name');
    const timeEl = document.getElementById('radar-timestamp');
    if (stationEl && timeEl) {
        const site = state.radarSites.find(s => s.id === stationId);
        stationEl.textContent = `${stationId} ${site ? `(${site.city})` : ''}`;
        timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

export function findNearestRadar(force = false) {
    if (!state.activeRadarId && !force) return;
    const center = state.map.getCenter();
    
    let minDistance = Infinity;
    let nearestSite = null;

    state.radarSites.forEach(site => {
        const dist = Math.sqrt(Math.pow(center.lng - site.lon, 2) + Math.pow(center.lat - site.lat, 2));
        if (dist < minDistance) {
            minDistance = dist;
            nearestSite = site;
        }
    });

    if (nearestSite && nearestSite.id !== state.activeRadarId) {
        loadRadar(nearestSite.id);
    }
}
