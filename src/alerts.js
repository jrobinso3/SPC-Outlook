import { state } from './state.js';
import { CONFIG } from './config.js';
import { updateMapLegend } from './legend.js';
import { DataProvider } from './api.js';
import { ThemeManager } from './theme.js';
import { getFirstLabelLayerId } from './map.js';

export async function loadLiveAlerts() {
    const map = state.map;
    if (!map) return;

    try {
        const events = ['Tornado Warning', 'Tornado Watch', 'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch', 'Severe Weather Statement'];
        const params = new URLSearchParams({ event: events.join(','), status: 'actual' });
        const url = `${CONFIG.alertsApi}?${params.toString()}`;
        
        // Remove existing layers and sources
        ['alerts-fill', 'alerts-border', 'alerts-pds', 'watches-fill', 'watches-border'].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
        });
        if (map.getSource('alerts-src')) map.removeSource('alerts-src');
        if (map.getSource('watches-src')) map.removeSource('watches-src');

        if (!state.showAlerts && !state.showWatches) {
            state.alertCounts = {};
            state.activeAlertTypes = [];
            updateMapLegend();
            return;
        }

        const response = await fetch(url, {
            headers: { 'User-Agent': 'SPC-Outlook-Dashboard (github.com/jrobinso3/SPC-Outlook)' },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Alerts fetch failed');
        const data = await response.json();
        if (!data || !data.features) return;

        const beforeId = getFirstLabelLayerId(map);

        // 1. Process Watches via DataProvider
        let watchData = { type: 'FeatureCollection', features: [] };
        try {
            watchData = await DataProvider.fetchWatchPolygons();
        } catch (e) {
            console.warn('Watch polygon fetch failed:', e);
        }

        if (state.showWatches && watchData.features.length > 0) {
            map.addSource('watches-src', { type: 'geojson', data: watchData });
            
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
                    'fill-opacity': 0.4
                }
            }, beforeId);

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
            }, beforeId);
        }

        // 2. Process Warnings
        const warningFeatures = data.features.filter(f => f.properties.event && f.properties.event.includes('Warning'));
        if (state.showAlerts && warningFeatures.length > 0) {
            map.addSource('alerts-src', { type: 'geojson', data: { type: 'FeatureCollection', features: warningFeatures } });
            
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
            }, beforeId);

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
            }, beforeId);

            // Special handling for PDS / Emergency is skipped for now or done via separate layer
        }

        // 3. Update Legend counts
        const counts = {};
        if (state.showAlerts) warningFeatures.forEach(f => { const e = f.properties.event; counts[e] = (counts[e] || 0) + 1; });
        if (state.showWatches) watchData.features.forEach(f => { const e = f.properties.event; counts[e] = (counts[e] || 0) + 1; });
        
        state.alertCounts = counts;
        state.activeAlertTypes = Object.keys(counts);
        
        setupAlertInteractions();
        updateMapLegend();
        
    } catch (error) {
        console.error('Error loading live alerts:', error);
    }
}

function setupAlertInteractions() {
    const map = state.map;

    ['alerts-fill', 'watches-fill'].forEach(layerId => {
        if (!map.getLayer(layerId)) return;

        map.on('click', layerId, (e) => {
            if (!e.features.length) return;
            const p = e.features[0].properties;
            const style = ThemeManager.getAlertStyle({ properties: p });
            const color = style.fillColor;

            const content = `
                <div class="popup-content max-h-80 overflow-y-auto pr-1">
                    <h4 class="text-lg font-bold mb-1" style="color: ${color}">${p.event}</h4>
                    <p class="text-xs text-slate-300 mb-2">${p.headline || 'Active Warning'}</p>
                    <hr class="my-2 border-white/10">
                    <div class="text-[10px] text-slate-300 leading-normal mb-3 whitespace-pre-wrap">${p.description || ''}</div>
                    <div class="text-[10px] text-slate-400">Valid Until: ${new Date(p.expires).toLocaleString()}</div>
                </div>
            `;

            new maplibregl.Popup({ className: 'custom-popup', maxWidth: '260px' })
                .setLngLat(e.lngLat)
                .setHTML(content)
                .addTo(map);
        });

        map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
        });
    });
}
