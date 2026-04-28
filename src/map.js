import { state, saveAppState, loadAppState } from './state.js';
import { CONFIG } from './config.js';
import { fetchRadarSites, findNearestRadar } from './radar.js';
import { loadLiveAlerts } from './alerts.js';
import { initUIListeners } from './ui.js';
import { switchOutlook } from './outlooks.js';

export async function initMap() {
    const savedState = loadAppState();

    let startCenter = [CONFIG.mapCenter[1], CONFIG.mapCenter[0]];
    if (savedState?.center) {
        const c = savedState.center;
        const lng = Array.isArray(c) ? c[1] : (c.lng || c.lon);
        const lat = Array.isArray(c) ? c[0] : c.lat;
        if (!isNaN(lng) && !isNaN(lat)) startCenter = [lng, lat];
    }
    const startZoom = savedState?.zoom || CONFIG.initialZoom;

    const styleUrl = 'https://api.maptiler.com/maps/019dd63d-eedc-7a5e-bdc6-91ef995b7812/style.json?key=snXh093GMfKPzv2loT4i';

    state.map = new maplibregl.Map({
        container: 'map',
        style: styleUrl,
        center: startCenter,
        zoom: startZoom,
        attributionControl: false
    });



    // state.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    state.map.on('load', () => {
        fetchRadarSites();
        loadLiveAlerts();
        initUIListeners();

        if (state.showOutlooks) {
            const defaultLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey) || CONFIG.layers[0];
            if (defaultLayer) switchOutlook(defaultLayer);
        }

        // Global Click Logic
        state.map.on('click', (e) => {
            const layers = ['alerts-fill', 'radar-sites', 'watches-fill', 'outlook-fill'];
            const features = state.map.queryRenderedFeatures(e.point, { layers: layers.filter(l => state.map.getLayer(l)) });

            if (!features.length) return;
            const top = features[0];
            const lid = top.layer.id;

            if (lid === 'alerts-fill' || lid === 'watches-fill') {
                import('./alerts.js').then(m => m.handleAlertClick(e, top));
            } else if (lid === 'radar-sites') {
                import('./radar.js').then(m => m.loadRadar(top.properties.id));
            } else if (lid === 'outlook-fill') {
                import('./outlooks.js').then(m => m.handleOutlookClick(e, top));
            }
        });

        state.map.on('mousemove', (e) => {
            const layers = ['alerts-fill', 'radar-sites', 'watches-fill', 'outlook-fill'];
            const features = state.map.queryRenderedFeatures(e.point, { layers: layers.filter(l => state.map.getLayer(l)) });
            state.map.getCanvas().style.cursor = features.length ? 'pointer' : '';
        });

        let moveTimeout;
        state.map.on('moveend', () => {
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(() => {
                findNearestRadar();
                saveAppState();
            }, 250);
        });
    });

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
        state.map.flyTo({ center: [longitude, latitude], zoom: 10, essential: true });
        if (state.userMarker) state.userMarker.remove();
        state.userMarker = new maplibregl.Marker({ color: '#0ea5e9' }).setLngLat([longitude, latitude]).addTo(state.map);
        import('./radar.js').then(m => m.findNearestRadar(true));
    });
}

export function getLayerAnchor(type) {
    const map = state.map;
    if (!map) return null;
    const layers = map.getStyle().layers;

    // Find first road or label layer to stay beneath
    const roadOrLabel = layers.find(l => 
        l.id.includes('road') || 
        l.id.includes('highway') || 
        l.id.includes('transportation') || 
        l.type === 'symbol' || 
        l.id.includes('label')
    )?.id;

    if (type === 'warnings') return roadOrLabel;
    if (type === 'radar') return layers.find(l => l.id === 'alerts-fill')?.id || roadOrLabel;
    if (type === 'watches') return layers.find(l => l.id === 'radar-raster')?.id || layers.find(l => l.id === 'alerts-fill')?.id || roadOrLabel;
    if (type === 'outlooks') return layers.find(l => l.id === 'watches-fill')?.id || layers.find(l => l.id === 'radar-raster')?.id || roadOrLabel;
    
    return roadOrLabel;
}
