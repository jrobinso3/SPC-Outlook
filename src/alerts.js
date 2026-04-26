import { state } from './state.js';
import { CONFIG } from './config.js';

export async function loadLiveAlerts() {
    try {
        const events = ['Tornado Warning', 'Tornado Watch', 'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch'];
        const url = `${CONFIG.alertsApi}?event=${encodeURIComponent(events.join(','))}`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'SPC-Outlook-Dashboard (github.com/jrobinso3/SPC-Outlook)' },
            cache: 'no-store'
        });
        
        if (!response.ok) throw new Error('Alerts fetch failed');
        const data = await response.json();
        
        const priorityOrder = {
            'Tornado Warning': 4,
            'Severe Thunderstorm Warning': 3,
            'Tornado Watch': 2,
            'Severe Thunderstorm Watch': 1
        };
        
        data.features.sort((a, b) => {
            return (priorityOrder[a.properties.event] || 0) - (priorityOrder[b.properties.event] || 0);
        });

        if (state.activeAlertsLayer) state.map.removeLayer(state.activeAlertsLayer);
        
        state.activeAlertsLayer = L.geoJSON(data, {
            pane: 'alertPane',
            style: getAlertStyle,
            onEachFeature: onEachAlert
        });
        
        if (state.showAlerts) state.activeAlertsLayer.addTo(state.map);
        
        updateAlertUI(data.features);
        
    } catch (error) {
        console.error('Error loading live alerts:', error);
    }
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
    } else if (event.includes('Severe Thunderstorm Warning')) {
        const isDestructive = desc.includes('DESTRUCTIVE') || desc.includes('80 MPH');
        if (isDestructive) {
            color = '#cc7a00';
            weight = 3;
        } else {
            color = '#ffa500';
        }
    } else if (event.includes('Severe Thunderstorm Watch')) {
        color = '#db7093';
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

function onEachAlert(feature, layer) {
    const props = feature.properties;
    const desc = (props.description || '').toUpperCase();
    const headline = (props.headline || '').toUpperCase();
    
    const parameters = props.parameters || {};
    const tornadoThreat = (parameters.tornadoDamageThreat || [''])[0].toUpperCase();
    const isTornadoWarning = props.event === 'Tornado Warning';
    const hasDangerous = desc.includes('DANGEROUS') || 
                         headline.includes('DANGEROUS') || 
                         (props.instruction || '').toUpperCase().includes('DANGEROUS');

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
        innerStripe.addTo(state.map);
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

function updateAlertUI(features) {
    const counts = {
        'Tornado Warning': 0,
        'Tornado Watch': 0,
        'Severe Thunderstorm Warning': 0,
        'Severe Thunderstorm Watch': 0
    };
    
    features.forEach(f => {
        if (counts.hasOwnProperty(f.properties.event)) {
            counts[f.properties.event]++;
        }
    });
    
    const container = document.getElementById('alert-status');
    if (!container) return;
    
    let html = '';
    if (counts['Tornado Warning'] > 0) html += `<span class="flex items-center gap-1.5 text-red-500 font-bold animate-pulse"><span class="w-2 h-2 rounded-full bg-red-500"></span> ${counts['Tornado Warning']} TOR-W</span>`;
    if (counts['Severe Thunderstorm Warning'] > 0) html += `<span class="flex items-center gap-1.5 text-orange-500 font-bold"><span class="w-2 h-2 rounded-full bg-orange-500"></span> ${counts['Severe Thunderstorm Warning']} SVR-W</span>`;
    
    container.innerHTML = html || '<span class="text-slate-500 text-xs italic">No active warnings</span>';
}
