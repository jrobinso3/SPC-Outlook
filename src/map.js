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

    state.map.createPane('watchPane');
    state.map.getPane('watchPane').style.zIndex = 400;

    state.map.createPane('radarPane');
    state.map.getPane('radarPane').style.zIndex = 450;

    state.map.createPane('alertPane');
    state.map.getPane('alertPane').style.zIndex = 550;

    state.map.createPane('labelsPane');
    state.map.getPane('labelsPane').style.zIndex = 700;
    state.map.getPane('labelsPane').style.pointerEvents = 'none';

    // Add zoom control to top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(state.map);

    // Dark Matter base tiles (Bottom)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);

    // Major Roads & Reference Labels overlay (Top)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        pane: 'labelsPane',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
        maxZoom: 20,
        opacity: 0.5
    }).addTo(state.map);

    state.map.getPane('labelsPane').style.filter = 'brightness(0.8) contrast(1.1)';

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
        if (state.showAlerts) {
            loadLiveAlerts();
        }
    }, 60000);
}
