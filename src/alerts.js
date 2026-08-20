const maplibregl = typeof window !== 'undefined' && window.maplibregl ? window.maplibregl : {};
import { state } from './state.js';
import { updateMapLegend } from './legend.js';
import { AlertsService } from './services/alerts-service.js';
import { ThemeManager } from './theme.js';
import { getLayerAnchor } from './map.js';
import { log } from './logger.js';

let previousWarnings = [];
let previousWatchCount = 0;

export async function loadLiveAlerts(forceRefresh = false) {
    const map = state.map;
    if (!map) return;
    log.alerts('loadLiveAlerts() starting...');

    try {
        if (!state.showAlerts && !state.showWatches) {
            log.alerts('Alerts and watches disabled in state');
            ['alerts-fill', 'alerts-border', 'watches-fill', 'watches-border'].forEach(id => {
                if (map.getLayer(id)) map.removeLayer(id);
            });
            if (map.getSource('alerts-src')) map.removeSource('alerts-src');
            if (map.getSource('watches-src')) map.removeSource('watches-src');
            state.alertCounts = {};
            state.activeAlertTypes = [];
            previousWarnings = [];
            previousWatchCount = 0;
            updateMapLegend();
            return;
        }

        // 1. Fetch live warnings & watches concurrently via AlertsService
        const [warningFeatures, watchData] = await Promise.all([
            state.showAlerts ? AlertsService.fetchActiveWarnings(forceRefresh) : Promise.resolve([]),
            state.showWatches ? AlertsService.fetchWatchPolygons(forceRefresh) : Promise.resolve({ type: 'FeatureCollection', features: [] })
        ]);

        state.warningFeatures = warningFeatures;

        // 2. Diffing: check if warnings or watches changed
        const warningsChanged = AlertsService.hasWarningsChanged(warningFeatures, previousWarnings);
        const watchesChanged = watchData.features.length !== previousWatchCount;

        if (!warningsChanged && !watchesChanged && map.getSource('alerts-src')) {
            log.alerts('Alerts have not changed since last poll; skipping redraw.');
            return;
        }

        previousWarnings = warningFeatures;
        previousWatchCount = watchData.features.length;

        // 3. Render Watches
        if (map.getLayer('watches-fill')) map.removeLayer('watches-fill');
        if (map.getLayer('watches-border')) map.removeLayer('watches-border');
        if (map.getSource('watches-src')) map.removeSource('watches-src');

        if (state.showWatches && watchData.features.length > 0) {
            map.addSource('watches-src', { type: 'geojson', data: watchData });
            const watchAnchor = getLayerAnchor('watches');

            map.addLayer({
                id: 'watches-fill',
                type: 'fill',
                source: 'watches-src',
                paint: {
                    'fill-color': ['match', ['get', 'event'],
                        'Tornado Watch', '#ffff00',
                        'Severe Thunderstorm Watch', '#db7093',
                        '#808080'
                    ],
                    'fill-opacity': 0.35
                }
            }, watchAnchor);

            map.addLayer({
                id: 'watches-border',
                type: 'line',
                source: 'watches-src',
                paint: {
                    'line-color': ['match', ['get', 'event'],
                        'Tornado Watch', '#ffff00',
                        'Severe Thunderstorm Watch', '#db7093',
                        '#808080'
                    ],
                    'line-width': 2
                }
            }, watchAnchor);
        }

        // 4. Render Warnings
        if (map.getLayer('alerts-fill')) map.removeLayer('alerts-fill');
        if (map.getLayer('alerts-border')) map.removeLayer('alerts-border');
        if (map.getSource('alerts-src')) map.removeSource('alerts-src');

        if (state.showAlerts && warningFeatures.length > 0) {
            map.addSource('alerts-src', { type: 'geojson', data: { type: 'FeatureCollection', features: warningFeatures } });
            const warningAnchor = getLayerAnchor('warnings');

            map.addLayer({
                id: 'alerts-fill',
                type: 'fill',
                source: 'alerts-src',
                paint: {
                    'fill-color': ['match', ['get', 'event'],
                        'Tornado Warning', '#ff0000',
                        'Severe Thunderstorm Warning', '#ffa500',
                        'Severe Weather Statement', '#00ffff',
                        '#808080'
                    ],
                    'fill-opacity': 0.4
                }
            }, warningAnchor);

            map.addLayer({
                id: 'alerts-border',
                type: 'line',
                source: 'alerts-src',
                paint: {
                    'line-color': ['match', ['get', 'event'],
                        'Tornado Warning', '#ff0000',
                        'Severe Thunderstorm Warning', '#ffa500',
                        'Severe Weather Statement', '#00ffff',
                        '#808080'
                    ],
                    'line-width': 2.5
                }
            }, warningAnchor);

            log.alerts(`Updated warning layers for ${warningFeatures.length} active warnings`);
        }

        // 5. Update Legend counts
        const counts = {};
        if (state.showAlerts) warningFeatures.forEach(f => { const e = f.properties.event; counts[e] = (counts[e] || 0) + 1; });
        if (state.showWatches) watchData.features.forEach(f => { const e = f.properties.event; counts[e] = (counts[e] || 0) + 1; });
        
        state.alertCounts = counts;
        state.activeAlertTypes = Object.keys(counts);
        updateMapLegend();
        
    } catch (error) {
        log.error('Alerts', 'Error loading live alerts:', error);
    }
}

/**
 * Handles clicks on alert layers (Warnings/Watches)
 */
export function handleAlertClick(e, feature) {
    const map = state.map;
    const p = feature.properties || {};
    const style = ThemeManager.getAlertStyle({ properties: p });
    const color = style.fillColor;

    const content = `
        <div class="popup-content max-h-80 overflow-y-auto pr-1">
            <h4 class="text-lg font-bold mb-1" style="color: ${color}">${p.event || 'Active Alert'}</h4>
            <p class="text-xs text-slate-300 mb-2">${p.headline || 'Active Alert'}</p>
            <hr class="my-2 border-white/10">
            <div class="text-[10px] text-slate-300 leading-normal mb-3 whitespace-pre-wrap">${p.description || ''}</div>
            <div class="text-[10px] text-slate-400 font-mono">Expires: ${p.expires ? new Date(p.expires).toLocaleString() : 'N/A'}</div>
        </div>
    `;

    new maplibregl.Popup({ className: 'custom-popup', maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setHTML(content)
        .addTo(map);
}

