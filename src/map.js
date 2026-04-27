import { state, saveAppState, loadAppState } from './state.js';
import { CONFIG } from './config.js';
import { fetchRadarSites, findNearestRadar } from './radar.js';
import { loadLiveAlerts } from './alerts.js';
import { initUIListeners } from './ui.js';
import { switchOutlook } from './outlooks.js';

export function initMap() {
    const savedState = loadAppState();

    // Defensive center normalization for MapLibre [lng, lat]
    let startCenter = [CONFIG.mapCenter[1], CONFIG.mapCenter[0]];
    if (savedState?.center) {
        const c = savedState.center;
        // Handle both [lat, lng] array and {lat, lng} object
        const lng = Array.isArray(c) ? c[1] : (c.lng || c.lon);
        const lat = Array.isArray(c) ? c[0] : c.lat;
        
        if (!isNaN(lng) && !isNaN(lat)) {
            startCenter = [lng, lat];
        }
    }
    const startZoom = savedState?.zoom || CONFIG.initialZoom;

    state.map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: startCenter,
        zoom: startZoom,
        attributionControl: false,
        // Override glyphs to a more reliable source if OpenFreeMap is failing
        transformRequest: (url, resourceType) => {
            if (resourceType === 'Glyphs') {
                // Redirect to a stable font server and simplify the font stack to one that exists there
                const newUrl = url
                    .replace('tiles.openfreemap.org/fonts', 'demotiles.maplibre.org/font')
                    .replace('Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular', 'Noto%20Sans%20Regular')
                    .replace('Open%20Sans%20Semibold,Arial%20Unicode%20MS%20Regular', 'Noto%20Sans%20Bold');
                return { url: newUrl };
            }
        }
    });

    // Handle missing images (like circle-11) by providing a fallback
    // Must be attached BEFORE 'load' event as style starts requesting images early
    state.map.on('styleimagemissing', (e) => {
        const id = e.id;
        if (id.includes('circle')) {
            const size = 16;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
            ctx.fillStyle = '#0ea5e9';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            state.map.addImage(id, ctx.getImageData(0, 0, size, size));
        }
    });

    state.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    state.map.on('load', () => {
        // Initialize core systems
        fetchRadarSites();
        loadLiveAlerts();
        initUIListeners();

        // Initial Outlook Load
        if (state.showOutlooks) {
            const defaultLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey) || CONFIG.layers[0];
            if (defaultLayer) switchOutlook(defaultLayer);
        }

        // Auto-switch radar based on map center
        let moveTimeout;
        state.map.on('moveend', () => {
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(() => {
                const center = state.map.getCenter();
                // MapLibre center to [lat, lng] for internal state/radar logic
                const latLng = [center.lat, center.lng];
                findNearestRadar();
                saveAppState();
            }, 250);
        });
    });

    // Heartbeats
    setInterval(() => {
        if (state.showRadar && state.activeRadarId) {
            import('./radar.js').then(m => m.loadRadar(state.activeRadarId, true));
        }
    }, 30000);
}

export function locateUser() {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        
        state.map.flyTo({
            center: [longitude, latitude],
            zoom: 10,
            essential: true
        });

        if (state.userMarker) state.userMarker.remove();
        
        state.userMarker = new maplibregl.Marker({ color: '#0ea5e9' })
            .setLngLat([longitude, latitude])
            .addTo(state.map);
            
        import('./radar.js').then(m => m.findNearestRadar(true));
    });
}

// Utility to find the first label layer for the "Sandwich" effect
export function getFirstLabelLayerId(map) {
    const layers = map.getStyle().layers;
    for (const layer of layers) {
        if (layer.type === 'symbol') return layer.id;
    }
    return null;
}
