import { state } from './state.js';
import { CONFIG } from './config.js';
import { updateMapLegend } from './legend.js';
import { DataProvider } from './api.js';
import { ThemeManager } from './theme.js';

export async function loadLiveAlerts() {
    try {
        const events = ['Tornado Warning', 'Tornado Watch', 'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch', 'Severe Weather Statement'];
        const params = new URLSearchParams({ event: events.join(','), status: 'actual' });
        const url = `${CONFIG.alertsApi}?${params.toString()}`;
        
        if (!state.showAlerts && !state.showWatches) {
            state.activeAlertsLayer?.clearLayers();
            state.activeWatchesLayer?.clearLayers();
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

        const priorityOrder = { 'Tornado Warning': 4, 'Severe Thunderstorm Warning': 3, 'Tornado Watch': 2, 'Severe Thunderstorm Watch': 1 };
        data.features.sort((a, b) => (priorityOrder[a.properties.event] || 0) - (priorityOrder[b.properties.event] || 0));

        if (!state.activeAlertsLayer) state.activeAlertsLayer = L.featureGroup().addTo(state.map);
        if (!state.activeWatchesLayer) state.activeWatchesLayer = L.featureGroup().addTo(state.map);
        
        state.activeAlertsLayer.clearLayers();
        state.activeWatchesLayer.clearLayers();

        // 1. Process Watches via DataProvider
        let watchData = { type: 'FeatureCollection', features: [] };
        try {
            watchData = await DataProvider.fetchWatchPolygons();
        } catch (e) {
            console.warn('Watch polygon fetch failed:', e);
        }

        if (state.showWatches && watchData.features.length > 0) {
            state.activeWatchesLayer.addLayer(L.geoJSON(watchData, {
                pane: 'watchPane',
                style: ThemeManager.getAlertStyle,
                onEachFeature: (f, l) => onEachAlert(f, l, state.activeWatchesLayer)
            }));
        }

        // 2. Process Warnings
        const warningFeatures = data.features.filter(f => f.properties.event && f.properties.event.includes('Warning'));
        if (state.showAlerts && warningFeatures.length > 0) {
            state.activeAlertsLayer.addLayer(L.geoJSON({ type: 'FeatureCollection', features: warningFeatures }, {
                pane: 'alertPane',
                style: ThemeManager.getAlertStyle,
                onEachFeature: (f, l) => onEachAlert(f, l, state.activeAlertsLayer)
            }));
        }

        // 3. Update Legend counts
        const counts = {};
        if (state.showAlerts) warningFeatures.forEach(f => { const e = f.properties.event; counts[e] = (counts[e] || 0) + 1; });
        if (state.showWatches) watchData.features.forEach(f => { const e = f.properties.event; counts[e] = (counts[e] || 0) + 1; });
        
        state.alertCounts = counts;
        state.activeAlertTypes = Object.keys(counts);
        updateMapLegend();
        
    } catch (error) {
        console.error('Error loading live alerts:', error);
    }
}

function onEachAlert(feature, layer, parentGroup) {
    const p = feature.properties;
    const desc = (p.description || '').toUpperCase();
    const headline = (p.headline || '').toUpperCase();
    const tornadoThreat = ((p.parameters || {}).tornadoDamageThreat || [''])[0].toUpperCase();
    
    const isPDS = desc.includes('PARTICULARLY DANGEROUS') || headline.includes('PARTICULARLY DANGEROUS') || 
                  (p.instruction || '').toUpperCase().includes('PARTICULARLY DANGEROUS') ||
                  tornadoThreat === 'CONSIDERABLE' || tornadoThreat === 'DESTRUCTIVE';
    
    const isEmergency = desc.includes('TORNADO EMERGENCY') || headline.includes('EMERGENCY') || tornadoThreat === 'CATASTROPHIC';

    if (isPDS || isEmergency) {
        parentGroup?.addLayer(L.geoJSON(feature, {
            style: { color: '#ffffff', weight: 2, fill: false, opacity: 1, pane: 'alertPane' },
            interactive: false
        }));
    }

    const style = ThemeManager.getAlertStyle(feature);
    const color = style.fillColor;

    const content = `
        <div class="popup-content max-h-80 overflow-y-auto pr-1">
            <h4 class="text-lg font-bold mb-1" style="color: ${color}">${p.event}</h4>
            ${isPDS ? '<div class="text-[9px] font-bold text-[#ff00ff] uppercase tracking-tighter mb-1">Particularly Dangerous Situation</div>' : ''}
            <p class="text-xs text-slate-300 mb-2">${p.headline || 'Active Warning'}</p>
            <hr class="my-2 border-white/10">
            <div class="text-[10px] text-slate-300 leading-normal mb-3 whitespace-pre-wrap">${p.description || ''}</div>
            <div class="text-[10px] text-slate-400">Valid Until: ${new Date(p.expires).toLocaleString()}</div>
        </div>
    `;
    layer.bindPopup(content, { maxWidth: 260, className: 'custom-popup' });
    
    layer.on('mouseover', function() { this.setStyle({ fillOpacity: 0.7 }); });
    layer.on('mouseout', function() { this.setStyle({ fillOpacity: 0.4 }); });
}

