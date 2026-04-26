import { state } from './state.js';
import { CONFIG } from './config.js';
import { updateMapLegend } from './legend.js';

export async function loadLiveAlerts() {
    try {
        const events = [
            'Tornado Warning', 
            'Tornado Watch', 
            'Severe Thunderstorm Warning', 
            'Severe Thunderstorm Watch',
            'Severe Weather Statement'
        ];
        
        const params = new URLSearchParams({
            event: events.join(','),
            status: 'actual'
        });
        
        const url = `${CONFIG.alertsApi}?${params.toString()}`;
        
        // If everything is disabled, clear and exit early to save bandwidth
        if (!state.showAlerts && !state.showWatches) {
            if (state.activeAlertsLayer) state.activeAlertsLayer.clearLayers();
            if (state.activeWatchesLayer) state.activeWatchesLayer.clearLayers();
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

        const priorityOrder = {
            'Tornado Warning': 4,
            'Severe Thunderstorm Warning': 3,
            'Tornado Watch': 2,
            'Severe Thunderstorm Watch': 1
        };
        
        data.features.sort((a, b) => {
            return (priorityOrder[a.properties.event] || 0) - (priorityOrder[b.properties.event] || 0);
        });

        // Initialize groups if needed and ensure they are on the map
        if (!state.activeAlertsLayer) state.activeAlertsLayer = L.featureGroup().addTo(state.map);
        if (!state.activeWatchesLayer) state.activeWatchesLayer = L.featureGroup().addTo(state.map);
        
        // Clear old data
        state.activeAlertsLayer.clearLayers();
        state.activeWatchesLayer.clearLayers();

        // 1. Process Watches (Fetched from ArcGIS MapServer)
        let watchData = { type: 'FeatureCollection', features: [] };
        try {
            watchData = await loadWatchPolygons();
        } catch (e) {
            console.warn('Watch polygon fetch failed:', e);
        }

        if (state.showWatches && watchData.features.length > 0) {
            const watchGeojson = L.geoJSON(watchData, {
                pane: 'watchPane',
                style: getAlertStyle,
                onEachFeature: (f, l) => onEachAlert(f, l, state.activeWatchesLayer)
            });
            state.activeWatchesLayer.addLayer(watchGeojson);
        }

        // 2. Process Warnings (Fetched from NWS API)
        const warningFeatures = data.features.filter(f => f.properties.event && f.properties.event.includes('Warning'));
        if (state.showAlerts && warningFeatures.length > 0) {
            const warningData = { type: 'FeatureCollection', features: warningFeatures };
            const warningGeojson = L.geoJSON(warningData, {
                pane: 'alertPane',
                style: getAlertStyle,
                onEachFeature: (f, l) => onEachAlert(f, l, state.activeAlertsLayer)
            });
            state.activeAlertsLayer.addLayer(warningGeojson);
        }

        // 3. Update Legend counts
        const counts = {};
        if (state.showAlerts) {
            warningFeatures.forEach(f => {
                const evt = f.properties.event;
                counts[evt] = (counts[evt] || 0) + 1;
            });
        }
        if (state.showWatches) {
            watchData.features.forEach(f => {
                const evt = f.properties.event;
                counts[evt] = (counts[evt] || 0) + 1;
            });
        }
        
        state.alertCounts = counts;
        state.activeAlertTypes = Object.keys(counts);
        updateMapLegend();
        
    } catch (error) {
        console.error('Error loading live alerts:', error);
    }
}

// AI AGENT INSTRUCTION: DO NOT MODIFY `loadWatchPolygons` QUERY PARAMS OR DATA PARSING LOGIC.
// NWS API (/alerts/active) often omits geometries for large watches (providing only affectedZones).
// We rely on the ArcGIS FeatureServer (CONFIG.watchPolygonsApi) because it provides polygon geometries 
// ALONG with the critical `Event` and `Description` schema.
// Turf.union is strictly required here to cleanly dissolve the fragmented county-level sub-features 
// into a unified SPC Watch polygon before rendering on Leaflet.
async function loadWatchPolygons() {
    const where = encodeURIComponent("Event LIKE '%Thunderstorm Watch%' OR Event LIKE '%Tornado Watch%'");
    const url = `${CONFIG.watchPolygonsApi}/query?where=${where}&outFields=Event,Summary,End_,Description,Instruction&f=geojson`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Watch polygon fetch failed');
    const data = await response.json();

    if (!data.features) return { type: 'FeatureCollection', features: [] };

    // Group sub-features by SPC watch number so each watch renders as one entity
    const watchGroups = {};
    data.features.forEach(f => {
        const desc = f.properties.Description || '';
        const match = desc.match(/(?:TORNADO|SEVERE THUNDERSTORM)\s+WATCH\s+(\d+)/i);
        const watchKey = match ? `${f.properties.Event}_${match[1]}` : `${f.properties.Event}_${f.properties.End_}`;

        if (!watchGroups[watchKey]) {
            watchGroups[watchKey] = { representative: f, features: [] };
        }
        watchGroups[watchKey].features.push(f);
    });

    // Re-emit one normalized feature per SPC watch (MultiPolygon of all sub-features)
    const mergedFeatures = Object.values(watchGroups).map(({ representative, features }) => {
        const p = representative.properties;
        const desc = p.Description || '';
        const numMatch = desc.match(/(?:TORNADO|SEVERE THUNDERSTORM)\s+WATCH\s+(\d+)/i);
        const watchNum = numMatch ? numMatch[1] : '';

        // Dissolve sub-features into one shape, removing shared internal edges
        const dissolved = turf.union(turf.featureCollection(features));
        const geometry = dissolved ? dissolved.geometry : representative.geometry;

        return {
            type: 'Feature',
            geometry,
            properties: {
                event: p.Event,
                headline: `${p.Event}${watchNum ? ' #' + watchNum : ''}`,
                description: desc,
                expires: p.End_ ? new Date(p.End_).toISOString() : null,
                instruction: p.Instruction || ''
            }
        };
    });

    return { type: 'FeatureCollection', features: mergedFeatures };
}

function getAlertStyle(feature) {
    const props = feature.properties;
    const event = props.event;
    const headline = (props.headline || '').toUpperCase();
    const desc = (props.description || '').toUpperCase();
    
    let color = '#3b82f6'; 
    let weight = 2;
    let fillOpacity = 0.3;

    if (event.includes('Tornado Warning')) {
        const isEmergency = desc.includes('TORNADO EMERGENCY') || headline.includes('EMERGENCY');
        const isObserved = desc.includes('TORNADO...OBSERVED') || desc.includes('OBSERVED TORNADO');
        const isPDS = desc.includes('PARTICULARLY DANGEROUS SITUATION') || 
                      headline.includes('PARTICULARLY DANGEROUS SITUATION') || 
                      (props.instruction || '').toUpperCase().includes('PARTICULARLY DANGEROUS SITUATION') ||
                      headline.includes('PDS') || desc.includes('PDS');

        if (isEmergency) {
            color = '#ff00ff'; 
            weight = 12;
            fillOpacity = 0.5;
        } else if (isObserved || isPDS) {
            color = '#8b0000';
            weight = 10;
            fillOpacity = 0.4;
        } else {
            color = '#ff0000';
            weight = 2.5;
            fillOpacity = 0.3;
        }
    } else if (event.includes('Tornado Watch')) {
        color = '#ffff00';
        weight = 1;
        fillOpacity = 0.25;
        return {
            fillColor: color,
            weight: weight,
            opacity: 1,
            color: color,
            fillOpacity: fillOpacity
        };
    } else if (event.includes('Severe Thunderstorm Warning')) {
        const isDestructive = desc.includes('DESTRUCTIVE') || desc.includes('80 MPH');
        if (isDestructive) {
            color = '#cc7a00';
            weight = 4;
        } else {
            color = '#ffa500';
            weight = 2.5;
        }
    } else if (event.includes('Severe Thunderstorm Watch')) {
        color = '#db7093';
        weight = 1;
        fillOpacity = 0.25;
        return {
            fillColor: color,
            weight: weight,
            opacity: 1,
            color: color,
            fillOpacity: fillOpacity
        };
    }
    
    return {
        fillColor: color,
        weight: weight,
        opacity: 1,
        color: color,
        fillOpacity: fillOpacity,
        className: (event.includes('Tornado Warning') && (desc.includes('TORNADO...OBSERVED') || desc.includes('OBSERVED TORNADO'))) ? 'confirmed-tor' : ''
    };
}

function onEachAlert(feature, layer, parentGroup) {
    const props = feature.properties;
    const desc = (props.description || '').toUpperCase();
    const headline = (props.headline || '').toUpperCase();
    
    const parameters = props.parameters || {};
    const tornadoThreat = (parameters.tornadoDamageThreat || [''])[0].toUpperCase();
    const isTornadoWarning = props.event === 'Tornado Warning';
    const hasDangerous = desc.includes('PARTICULARLY DANGEROUS') ||
                         headline.includes('PARTICULARLY DANGEROUS') ||
                         (props.instruction || '').toUpperCase().includes('PARTICULARLY DANGEROUS');

    const isPDS = (isTornadoWarning && hasDangerous) ||
                  desc.includes('PARTICULARLY DANGEROUS SITUATION') ||
                  tornadoThreat === 'CONSIDERABLE' ||
                  tornadoThreat === 'DESTRUCTIVE';
    
    const isEmergency = desc.includes('TORNADO EMERGENCY') || 
                        headline.includes('EMERGENCY') ||
                        tornadoThreat === 'CATASTROPHIC';

    if (isPDS || isEmergency) {
        const innerStripe = L.geoJSON(feature, {
            style: {
                color: '#ffffff',
                weight: 2,
                fill: false,
                opacity: 1,
                pane: 'alertPane'
            },
            interactive: false
        });
        if (parentGroup) parentGroup.addLayer(innerStripe);
    }

    const content = `
        <div class="popup-content max-h-64 overflow-y-auto pr-1">
            <h4 class="text-xs font-bold" style="color: ${CONFIG.alertColors[props.event] || '#fff'}">${props.event}</h4>
            ${isPDS ? '<div class="mt-1 text-[9px] font-bold text-[#ff00ff] uppercase tracking-tighter">Particularly Dangerous Situation</div>' : ''}
            <p class="text-[10px] mt-1 font-semibold text-white">${props.headline || 'Active Warning'}</p>
            <hr class="my-2 border-white/10">
            <div class="text-[10px] text-slate-300 leading-normal mb-2 whitespace-pre-wrap">${props.description || ''}</div>
            <div class="text-[10px] text-slate-400 pt-2 border-t border-white/5">Expires: ${new Date(props.expires).toLocaleString()}</div>
        </div>
    `;
    layer.bindPopup(content, { 
        maxWidth: 240,
        className: 'alert-popup'
    });
    
    layer.on('mouseover', function() {
        this.setStyle({ fillOpacity: 0.7 });
    });
    layer.on('mouseout', function() {
        this.setStyle({ fillOpacity: 0.4 });
    });
}
