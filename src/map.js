import { state, saveAppState, loadAppState } from './state.js';
import { CONFIG } from './config.js';
import { fetchRadarSites, loadRadar, findNearestRadar } from './radar.js';
import { loadLiveAlerts } from './alerts.js';
import { initUIListeners } from './ui.js';
import { switchOutlook } from './outlooks.js';

export function initMap() {
    const savedState = loadAppState();

    const startCenter = savedState?.center || CONFIG.mapCenter;
    const startZoom = savedState?.zoom || CONFIG.initialZoom;

    state.map = L.map('map', {
        zoomControl: false
    }).setView(startCenter, startZoom);

    // Create custom panes for robust layer stacking
    state.map.createPane('outlookPane');
    state.map.getPane('outlookPane').style.zIndex = 350;

    state.map.createPane('sigPane');
    state.map.getPane('sigPane').style.zIndex = 360;
    state.map.getPane('sigPane').style.pointerEvents = 'none';

    state.map.createPane('watchPane');
    state.map.getPane('watchPane').style.zIndex = 400;

    state.map.createPane('radarPane');
    state.map.getPane('radarPane').style.zIndex = 450;

    state.map.createPane('alertPane');
    state.map.getPane('alertPane').style.zIndex = 550; // Warnings

    state.map.createPane('labelsPane');
    state.map.getPane('labelsPane').style.zIndex = 650;
    state.map.getPane('labelsPane').style.pointerEvents = 'none';

    // Add zoom control to top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(state.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        fadeAnimation: false
    }).addTo(state.map);

    // Major Roads overlay (Top)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        pane: 'labelsPane',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
        maxZoom: 20,
        opacity: 1,
        fadeAnimation: false
    }).addTo(state.map);

    // City & Place Labels (Absolute Top)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        pane: 'labelsPane',
        subdomains: 'abcd',
        maxZoom: 20,
        opacity: 1.0,
        fadeAnimation: false
    }).addTo(state.map);

    state.map.getPane('labelsPane').style.filter = 'brightness(0.9) contrast(1.2)';

    // Initialize core systems
    fetchRadarSites();
    loadLiveAlerts();

    // Auto-switch radar based on map center
    let moveTimeout;
    state.map.on('move', () => {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
            findNearestRadar();
            saveAppState();
        }, 250);
    });

    initUIListeners();

    // Initial Outlook Load
    if (state.showOutlooks) {
        const defaultLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey) || CONFIG.layers[0];
        if (defaultLayer) switchOutlook(defaultLayer);
    }

    // Heartbeats
    setInterval(() => {
        if (state.showRadar && state.activeRadarId) {
            loadRadar(state.activeRadarId, true);
        }
    }, 30000);

    setInterval(() => {
        if (state.showAlerts || state.showWatches) {
            loadLiveAlerts();
        }
    }, 60000);

    initHatchingPatterns();
}

export function locateUser() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    const btn = document.getElementById('get-location');
    btn.classList.add('text-blue-500', 'animate-pulse');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            state.map.setView([latitude, longitude], 9);

            // Add a small pulse marker for the user's location
            if (state.userMarker) state.map.removeLayer(state.userMarker);

            state.userMarker = L.circleMarker([latitude, longitude], {
                radius: 7,
                fillColor: '#3b82f6',
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 1,
                pane: 'labelsPane'
            }).addTo(state.map);

            // Optional: Add a subtle outer pulse halo
            const pulse = L.circleMarker([latitude, longitude], {
                radius: 15,
                fillColor: '#3b82f6',
                color: 'transparent',
                weight: 0,
                opacity: 0,
                fillOpacity: 0.2,
                pane: 'labelsPane'
            }).addTo(state.map);
            
            // Clean up pulse if marker is removed
            state.userMarker.on('remove', () => state.map.removeLayer(pulse));

            btn.classList.remove('text-blue-500', 'animate-pulse');
        },
        (error) => {
            console.error("Geolocation error:", error);
            btn.classList.remove('text-blue-500', 'animate-pulse');
            alert("Unable to retrieve your location. Please check your browser permissions.");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

function initHatchingPatterns() {
    // We need to wait for the Leaflet SVG container to be created
    const overlayPane = document.querySelector('.leaflet-overlay-pane');
    if (!overlayPane) {
        setTimeout(initHatchingPatterns, 100);
        return;
    }

    let svg = overlayPane.querySelector('svg');
    if (!svg) {
        // Create an SVG if it doesn't exist yet (Leaflet might create it on first path add)
        // But usually it's better to wait for Leaflet to create it
        setTimeout(initHatchingPatterns, 100);
        return;
    }

    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
    }

    // CIG1: Light Hatch (Single Slant)
    // CIG2: Med Hatch (Denser Slant)
    // CIG3: Double Hatch (Cross-Hatch)
    defs.innerHTML = `
        <pattern id="pattern-cig1" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" style="stroke:rgba(255,255,255,0.4); stroke-width:1" />
        </pattern>
        <pattern id="pattern-cig2" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" style="stroke:rgba(255,255,255,0.6); stroke-width:1.5" />
        </pattern>
        <pattern id="pattern-cig3" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" style="stroke:rgba(255,255,255,0.8); stroke-width:1.5" />
            <line x1="0" y1="0" x2="8" y2="0" style="stroke:rgba(255,255,255,0.8); stroke-width:1.5" />
        </pattern>
    `;
}
