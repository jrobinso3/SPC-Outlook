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

    // Clear existing HTML markers
    if (state.radarMarkers) {
        state.radarMarkers.forEach(m => m.remove());
    }
    state.radarMarkers = [];

    // Create/Refresh the hidden vector layer for easy map clicking
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
        type: 'circle',
        source: 'radar-sites-src',
        paint: {
            'circle-radius': 15,
            'circle-color': 'transparent',
            'circle-stroke-width': 0
        }
    });

    // Create the visual HTML "Pills"
    state.radarSites.forEach(site => {
        const el = document.createElement('div');
        el.className = 'radar-site-label';
        const sid = site.id.toUpperCase();
        
        if (state.activeRadarId?.toUpperCase() === sid) {
            el.classList.add('active-radar');
        }
        
        const span = document.createElement('span');
        span.textContent = sid;
        el.appendChild(span);

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([site.lon, site.lat])
            .addTo(map);

        // Initial visibility
        el.style.display = state.showRadarSites ? 'block' : 'none';

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            loadRadar(sid);
        });

        state.radarMarkers.push(marker);
    });
}

export function loadRadar(stationId, isHeartbeat = false) {
    const map = state.map;
    if (!map || !state.showRadar || !stationId) return;

    const wasAnimating = animationState.isPlaying;
    stopAnimation(true);

    const targetId = stationId.toUpperCase();
    const station = targetId.toLowerCase();
    const layerName = `${station}_${state.currentRadarProduct}`;
    
    // Remove existing radar layers
    if (map.getLayer('radar-raster')) map.removeLayer('radar-raster');
    if (map.getSource('radar-src')) map.removeSource('radar-src');

    const beforeId = getLayerAnchor('radar');
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

    state.activeRadarId = targetId;
    if (wasAnimating) toggleRadarAnimation();

    // Sync visual markers (active state)
    if (state.radarMarkers) {
        state.radarMarkers.forEach(marker => {
            const el = marker.getElement();
            const mid = el.textContent?.toUpperCase();
            if (mid === targetId) el.classList.add('active-radar');
            else el.classList.remove('active-radar');
        });
    }

    // Update UI Panel
    const stationEl = document.getElementById('radar-station-name');
    const timeEl = document.getElementById('radar-timestamp');
    if (stationEl && timeEl) {
        const site = state.radarSites.find(s => s.id.toUpperCase() === targetId);
        stationEl.textContent = `${targetId} ${site ? `(${site.city})` : ''}`;
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

    if (nearestSite && nearestSite.id.toUpperCase() !== state.activeRadarId?.toUpperCase()) {
        loadRadar(nearestSite.id);
    }
}
