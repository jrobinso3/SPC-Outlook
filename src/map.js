import { state, saveAppState, loadAppState } from './state.js';
import { CONFIG } from './config.js';
import { fetchRadarSites, findNearestRadar } from './radar.js';
import { loadLiveAlerts } from './alerts.js';
import { initUIListeners } from './ui.js';
import { switchOutlook } from './outlooks.js';
import { ThemeManager } from './theme.js';

import { URLShieldRenderer } from '@americana/maplibre-shield-generator';

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

    // Mutate the style for Americana Shield Generator
    let styleObj = 'https://tiles.openfreemap.org/styles/dark';
    try {
        const res = await fetch(styleObj);
        const json = await res.json();
        json.layers.forEach(layer => {
            if (layer.id.includes('shield') || (layer.id.includes('road') && layer.id.includes('label'))) {
                layer.layout = layer.layout || {};
                layer.layout['icon-image'] = [
                    'concat', 'shield|', ['get', 'network'], '|', ['get', 'ref'], '|', ['coalesce', ['get', 'name'], '']
                ];
                delete layer.layout['text-field'];
                layer.layout['icon-allow-overlap'] = true;
            }
        });
        styleObj = json;
    } catch (e) {
        console.error("Shield mutation failed:", e);
    }

    state.map = new maplibregl.Map({
        container: 'map',
        style: styleObj,
        center: startCenter,
        zoom: startZoom,
        attributionControl: false,
        transformRequest: (url, resourceType) => {
            if (resourceType === 'Glyphs') {
                const newUrl = url
                    .replace('tiles.openfreemap.org/fonts', 'demotiles.maplibre.org/font')
                    .replace('Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular', 'Noto%20Sans%20Regular')
                    .replace('Open%20Sans%20Semibold,Arial%20Unicode%20MS%20Regular', 'Noto%20Sans%20Bold');
                return { url: newUrl };
            }
        }
    });

    // Americana Shield Renderer
    const routeParser = {
        parse: (id) => {
            const parts = id.split('|');
            return { network: parts[1] || '', ref: parts[2] || '', name: parts[3] || '' };
        },
        format: (network, ref, name) => `shield|${network}|${ref}|${name}`
    };

    new URLShieldRenderer("https://osm-americana.github.io/openstreetmap-americana/shields.json", routeParser)
        .filterImageID(id => id.startsWith("shield|"))
        .renderOnMaplibreGL(state.map);

    state.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    state.map.on('load', () => {
        ThemeManager.applyPremiumStyles(state.map);
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
    const labelAnchor = layers.find(l => (l.type === 'symbol' || l.id.includes('label') || l.id.includes('place')) && !l.id.includes('radar'))?.id;
    if (type === 'warnings') return labelAnchor;
    if (type === 'radar') return layers.find(l => l.id === 'alerts-fill')?.id || labelAnchor;
    if (type === 'watches') return layers.find(l => l.id === 'radar-raster')?.id || layers.find(l => l.id === 'alerts-fill')?.id || labelAnchor;
    if (type === 'outlooks') return layers.find(l => l.id === 'watches-fill')?.id || layers.find(l => l.id === 'radar-raster')?.id || labelAnchor;
    return labelAnchor;
}
