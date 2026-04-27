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

    // Fetch and mutate the style to support Americana Shield Generator
    let styleObj = 'https://tiles.openfreemap.org/styles/dark';
    try {
        const res = await fetch('https://tiles.openfreemap.org/styles/dark');
        const json = await res.json();
        json.layers.forEach(layer => {
            if (layer.id.includes('highway-shield') || layer.id.includes('road_shield')) {
                layer.layout['icon-image'] = [
                    'concat',
                    'shield|',
                    ['get', 'network'],
                    '|',
                    ['get', 'ref'],
                    '|',
                    ['coalesce', ['get', 'name'], '']
                ];
                delete layer.layout['text-field'];
                layer.layout['icon-allow-overlap'] = true;
            }
        });
        styleObj = json;
    } catch (e) {
        console.error("Failed to fetch or mutate map style for shields:", e);
    }

    state.map = new maplibregl.Map({
        container: 'map',
        style: styleObj,
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

    // Initialize Americana Shield Renderer
    const routeParser = {
        parse: (id) => {
            const parts = id.split('|');
            return {
                network: parts[1] || '',
                ref: parts[2] || '',
                name: parts[3] || ''
            };
        },
        format: (network, ref, name) => `shield|${network}|${ref}|${name}`
    };

    const shieldPredicate = (id) => id.startsWith("shield|");

    new URLShieldRenderer("https://osm-americana.github.io/openstreetmap-americana/shields.json", routeParser)
        .filterImageID(shieldPredicate)
        .renderOnMaplibreGL(state.map);

    // Handle missing non-shield images (like circle-11) by providing a fallback
    state.map.on('styleimagemissing', (e) => {
        const id = e.id;
        const lo = id.toLowerCase();
        
        if (lo.startsWith('shield|')) return; // Handled by Americana

        if (lo.includes('circle')) {
            const size = 48;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#0ea5e9';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            state.map.addImage(id, ctx.getImageData(0, 0, size, size));
        } else {
            // Fully transparent 1x1 for anything unrecognised
            state.map.addImage(id, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) });
        }
    });

    state.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    state.map.on('load', () => {
        // Apply Apple Maps-style theme
        ThemeManager.applyPremiumStyles(state.map);

        // Initialize core systems
        fetchRadarSites();
        loadLiveAlerts();
        initUIListeners();

        // Initial Outlook Load
        if (state.showOutlooks) {
            const defaultLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey) || CONFIG.layers[0];
            if (defaultLayer) switchOutlook(defaultLayer);
        }

        // Centralized Click Handler (Raycasting)
        // Priority: Warnings > Radar Sites > Watches > Outlooks
        state.map.on('click', (e) => {
            const layers = ['alerts-fill', 'radar-sites', 'watches-fill', 'outlook-fill'];
            const features = state.map.queryRenderedFeatures(e.point, { layers: layers.filter(l => state.map.getLayer(l)) });

            if (!features.length) return;

            // Sort by priority (though queryRenderedFeatures usually returns in stack order, we'll be explicit)
            const topFeature = features[0];
            const layerId = topFeature.layer.id;

            if (layerId === 'alerts-fill' || layerId === 'watches-fill') {
                import('./alerts.js').then(m => m.handleAlertClick(e, topFeature));
            } else if (layerId === 'radar-sites') {
                import('./radar.js').then(m => m.loadRadar(topFeature.properties.id));
            } else if (layerId === 'outlook-fill') {
                import('./outlooks.js').then(m => m.handleOutlookClick(e, topFeature));
            }
        });

        // Hover cursor management
        state.map.on('mousemove', (e) => {
            const layers = ['alerts-fill', 'radar-sites', 'watches-fill', 'outlook-fill'];
            const features = state.map.queryRenderedFeatures(e.point, { layers: layers.filter(l => state.map.getLayer(l)) });
            state.map.getCanvas().style.cursor = features.length ? 'pointer' : '';
        });

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

// Utility to maintain correct layer stacking (The "Sandwich" logic)
// PRECISE ORDER: 1. Labels, 2. Warnings, 3. Radar, 4. Watches, 5. Outlooks, 6. Basemap
export function getLayerAnchor(type) {
    const map = state.map;
    if (!map) return null;
    
    const layers = map.getStyle().layers;
    // Anchor everything below the first label/road layer
    const labelAnchor = layers.find(l => 
        (l.type === 'symbol' || l.id.includes('label') || l.id.includes('place')) && !l.id.includes('radar')
    )?.id;

    if (type === 'warnings') return labelAnchor;
    
    if (type === 'radar') {
        const warningLayer = layers.find(l => l.id === 'alerts-fill')?.id;
        return warningLayer || labelAnchor;
    }

    if (type === 'watches') {
        const radarLayer = layers.find(l => l.id === 'radar-raster' || l.id.startsWith('radar-frame'))?.id;
        const warningLayer = layers.find(l => l.id === 'alerts-fill')?.id;
        return radarLayer || warningLayer || labelAnchor;
    }

    if (type === 'outlooks') {
        const watchLayer = layers.find(l => l.id === 'watches-fill')?.id;
        const radarLayer = layers.find(l => l.id === 'radar-raster' || l.id.startsWith('radar-frame'))?.id;
        const warningLayer = layers.find(l => l.id === 'alerts-fill')?.id;
        return watchLayer || radarLayer || warningLayer || labelAnchor;
    }

    return labelAnchor;
}

// ── Shield drawing helpers ──────────────────────────────────────────────────

function drawInterstateShield(ctx, s) {
    const pad = 3;
    const bodyTop = pad;
    const bodyBottom = s - pad;
    const midY = s * 0.62;

    // Pentagon body path
    const shieldPath = () => {
        ctx.beginPath();
        ctx.moveTo(pad, bodyTop);
        ctx.lineTo(s - pad, bodyTop);
        ctx.lineTo(s - pad, midY);
        ctx.quadraticCurveTo(s - pad, bodyBottom, s / 2, bodyBottom);
        ctx.quadraticCurveTo(pad, bodyBottom, pad, midY);
        ctx.closePath();
    };

    // Blue gradient body
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, '#1d4ed8');
    grad.addColorStop(1, '#1e40af');
    shieldPath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Red banner — clipped to shield shape so it doesn't bleed outside
    const bannerH = s * 0.28;
    ctx.save();
    shieldPath();
    ctx.clip();
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(pad, bodyTop, s - pad * 2, bannerH);
    ctx.restore();

    // White border
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2.5;
    shieldPath();
    ctx.stroke();
}

function drawUSHighwayShield(ctx, s) {
    const pad = 3;
    const inset = 5;

    // Keystone shape
    ctx.beginPath();
    ctx.moveTo(pad + inset, pad);
    ctx.lineTo(s - pad - inset, pad);
    ctx.lineTo(s - pad, pad + inset);
    ctx.lineTo(s - pad, s * 0.68);
    ctx.quadraticCurveTo(s - pad, s - pad, s / 2, s - pad);
    ctx.quadraticCurveTo(pad, s - pad, pad, s * 0.68);
    ctx.lineTo(pad, pad + inset);
    ctx.closePath();

    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
}

function drawStateRouteShield(ctx, s) {
    const pad = 4;
    const r = 7;

    // Rounded rectangle via arcTo
    ctx.beginPath();
    ctx.moveTo(pad + r, pad);
    ctx.lineTo(s - pad - r, pad);
    ctx.arcTo(s - pad, pad, s - pad, pad + r, r);
    ctx.lineTo(s - pad, s - pad - r);
    ctx.arcTo(s - pad, s - pad, s - pad - r, s - pad, r);
    ctx.lineTo(pad + r, s - pad);
    ctx.arcTo(pad, s - pad, pad, s - pad - r, r);
    ctx.lineTo(pad, pad + r);
    ctx.arcTo(pad, pad, pad + r, pad, r);
    ctx.closePath();

    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;
    ctx.stroke();
}
