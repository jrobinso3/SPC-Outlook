import * as npmMaplibre from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { state, saveAppState, loadAppState } from './state.js';
import { CONFIG } from './config.js';
import { fetchRadarSites, findNearestRadar, loadRadar } from './radar.js';
import { loadLiveAlerts, handleAlertClick } from './alerts.js';
import { initUIListeners } from './ui.js';
import { switchOutlook, handleOutlookClick } from './outlooks.js';
import { log } from './logger.js';

const maplibregl = (typeof window !== 'undefined' && window.maplibregl) ? window.maplibregl : npmMaplibre;

function parseValidCenter(c) {
    const defaultCenter = [CONFIG.mapCenter[1], CONFIG.mapCenter[0]]; // [-98.5795, 39.8283]
    if (!c) return defaultCenter;

    let lng = NaN;
    let lat = NaN;

    if (Array.isArray(c)) {
        if (c.length >= 2) {
            const first = Number(c[0]);
            const second = Number(c[1]);
            if (Math.abs(first) <= 180 && Math.abs(second) <= 90 && (first < -50 && first > -130)) {
                lng = first;
                lat = second;
            } else if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
                lat = first;
                lng = second;
            }
        }
    } else if (typeof c === 'object') {
        lng = Number(c.lng ?? c.lon ?? c.longitude);
        lat = Number(c.lat ?? c.latitude);
    }

    if (isNaN(lng) || isNaN(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        log.warn('Map', 'Saved center coordinates were out of bounds. Resetting to default CONUS center.', c);
        return defaultCenter;
    }

    return [lng, lat];
}

function parseValidZoom(z) {
    const num = Number(z);
    if (isNaN(num) || num < 1 || num > 22) {
        return CONFIG.initialZoom;
    }
    return num;
}

export async function initMap() {
    log.map('initMap() starting...');
    const savedState = loadAppState();

    const startCenter = parseValidCenter(savedState?.center);
    const startZoom = parseValidZoom(savedState?.zoom);

    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        log.error('Map', 'Fatal: #map container element not found in DOM!');
        return;
    }

    log.map('Initializing MapLibre instance with dataviz-dark style...', { center: startCenter, zoom: startZoom });

    try {
        state.map = new maplibregl.Map({
            container: 'map',
            style: CONFIG.mapStyleUrl,
            center: startCenter,
            zoom: startZoom,
            attributionControl: false,
            antialias: true
        });
    } catch (err) {
        log.error('Map', 'Error creating map, falling back to defaults:', err);
        state.map = new maplibregl.Map({
            container: 'map',
            style: CONFIG.mapStyleUrl,
            center: [CONFIG.mapCenter[1], CONFIG.mapCenter[0]],
            zoom: CONFIG.initialZoom,
            attributionControl: false,
            antialias: true
        });
    }

    // Initialize UI listeners immediately
    try {
        log.ui('Initializing UI listeners...');
        initUIListeners();
    } catch (e) {
        log.error('UI', 'Error initializing UI listeners:', e);
    }

    state.map.on('error', (e) => {
        log.warn('Map', 'MapLibre internal event error:', e);
    });

    state.map.once('load', async () => {
        log.map('Map load event fired! Initializing layers...');
        state.map.resize();

        // 1. Radar stations
        try {
            log.radar('Fetching radar sites...');
            await fetchRadarSites();
        } catch (e) {
            log.error('Radar', 'Error fetching radar sites:', e);
        }

        // 2. Active Warnings & Watches
        try {
            log.alerts('Loading live alerts and watches...');
            await loadLiveAlerts();
        } catch (e) {
            log.error('Alerts', 'Error loading live alerts:', e);
        }

        // 3. Active SPC Outlook
        if (state.showOutlooks) {
            try {
                const defaultLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey) || CONFIG.layers[0];
                if (defaultLayer) {
                    log.outlooks('Loading initial outlook layer:', defaultLayer.name);
                    await switchOutlook(defaultLayer);
                }
            } catch (e) {
                log.error('Outlooks', 'Error loading initial outlook:', e);
            }
        }

        // Global Map Click Handler
        state.map.on('click', (e) => {
            const queryLayers = ['alerts-fill', 'radar-sites', 'watches-fill', 'outlook-fill'].filter(id => state.map.getLayer(id));
            const features = state.map.queryRenderedFeatures(e.point, { layers: queryLayers });

            if (!features.length) return;
            const top = features[0];
            const lid = top.layer.id;
            log.ui('Map clicked feature on layer:', lid, top.properties);

            if (lid === 'alerts-fill' || lid === 'watches-fill') {
                handleAlertClick(e, top);
            } else if (lid === 'radar-sites') {
                loadRadar(top.properties.id);
            } else if (lid === 'outlook-fill') {
                handleOutlookClick(e, top);
            }
        });

        // Hover cursor pointer
        state.map.on('mousemove', (e) => {
            const queryLayers = ['alerts-fill', 'radar-sites', 'watches-fill', 'outlook-fill'].filter(id => state.map.getLayer(id));
            const features = state.map.queryRenderedFeatures(e.point, { layers: queryLayers });
            state.map.getCanvas().style.cursor = features.length ? 'pointer' : '';
        });

        // Save viewport state on pan/zoom
        let moveTimeout;
        state.map.on('moveend', () => {
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(() => {
                findNearestRadar();
                saveAppState();
            }, 300);
        });
    });

    // Radar heartbeat refresh every 30s
    setInterval(() => {
        if (state.showRadar && state.activeRadarId) {
            log.radar('Heartbeat: refreshing active radar layer:', state.activeRadarId);
            loadRadar(state.activeRadarId, true);
        }
    }, 30000);
}

export function locateUser() {
    log.ui('Locate user requested');
    if (!navigator.geolocation) {
        log.warn('UI', 'Geolocation is not supported by this browser');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            log.ui('User located:', { latitude, longitude });
            state.map.flyTo({ center: [longitude, latitude], zoom: 10, essential: true });
            if (state.userMarker) state.userMarker.remove();
            state.userMarker = new maplibregl.Marker({ color: '#0ea5e9' }).setLngLat([longitude, latitude]).addTo(state.map);
            findNearestRadar(true);
        },
        (err) => {
            log.warn('UI', 'Geolocation failed or permission denied:', err.message);
        }
    );
}

/**
 * Returns the layer ID of the first symbol/label layer
 * so outlooks and radar layers render underneath text labels.
 */
export function getLayerAnchor(type) {
    const map = state.map;
    if (!map) return undefined;
    const style = map.getStyle();
    if (!style || !style.layers) return undefined;
    const layers = style.layers;

    // Find first symbol (label) layer or road layer to stay beneath
    const labelLayer = layers.find(l => 
        l.type === 'symbol' || 
        l.id.includes('label') ||
        l.id.includes('border')
    )?.id;

    if (type === 'warnings') return labelLayer;
    if (type === 'radar') return layers.find(l => l.id === 'alerts-fill')?.id || labelLayer;
    if (type === 'watches') return layers.find(l => l.id === 'radar-raster')?.id || layers.find(l => l.id === 'alerts-fill')?.id || labelLayer;
    if (type === 'outlooks') return layers.find(l => l.id === 'watches-fill')?.id || layers.find(l => l.id === 'radar-raster')?.id || labelLayer;
    
    return labelLayer;
}
