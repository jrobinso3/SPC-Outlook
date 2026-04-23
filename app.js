/**
 * US Severe Weather Outlook Dashboard
 * Core logic for fetching and visualizing SPC outlook data.
 */

const CONFIG = {
    mapCenter: [39.8283, -98.5795], // Geograhic center of CONUS
    initialZoom: 4,
    apiBase: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer',
    layers: [
        { id: 1, name: 'Day 1 Categorical', key: 'day1cat', discussion: 'day1' },
        { id: 3, name: 'Day 1 Tornado', key: 'day1torn', discussion: 'day1' },
        { id: 5, name: 'Day 1 Hail', key: 'day1hail', discussion: 'day1' },
        { id: 7, name: 'Day 1 Wind', key: 'day1wind', discussion: 'day1' },
        { id: 9, name: 'Day 2 Categorical', key: 'day2cat', discussion: 'day2' },
        { id: 17, name: 'Day 3 Categorical', key: 'day3cat', discussion: 'day3' },
        { id: 21, name: 'Day 4 Probabilistic', key: 'day4prob', discussion: 'day48' },
        { id: 22, name: 'Day 5 Probabilistic', key: 'day5prob', discussion: 'day48' }
    ],
    discussionBase: 'https://www.spc.noaa.gov/products/outlook',
    colors: {
        // Categorical
        'TSTM': '#c1e9aa',
        'MRGL': '#008b00',
        'SLGT': '#ffff00',
        'ENH': '#ffa500',
        'MDT': '#ff0000',
        'HIGH': '#ff00ff',
        
        // Probabilistic (Tornado, Wind, Hail, Day 4-8)
        '0.02': '#008b00',
        '0.05': '#8b4726',
        '0.10': '#ffff00',
        '0.15': '#ff0000',
        '30%': '#ff00ff',
        '45%': '#912cee',
        '60%': '#104e8b',
        '15%': '#ff0000',
        '30%': '#ff00ff',
        'DEFAULT': '#3b82f6'
    },
    alertsApi: 'https://api.weather.gov/alerts/active',
    alertColors: {
        'Tornado Warning': '#ff0000',
        'Tornado Watch': '#ffff00',
        'Severe Thunderstorm Warning': '#ffa500',
        'Severe Thunderstorm Watch': '#db7093'
    }
};

let map;
let activeLayer;
const layerGroups = {};

function initMap() {
    map = L.map('map', {
        zoomControl: false
    }).setView(CONFIG.mapCenter, CONFIG.initialZoom);

    // Add zoom control to top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Dark Matter base tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    loadAllLayers();
    initUI();
}

function initUI() {
    const closeBtn = document.getElementById('close-panel');
    const sidePanel = document.getElementById('side-panel');
    const legendToggle = document.getElementById('legend-toggle');
    const legendClose = document.getElementById('legend-close');
    const legendContainer = document.getElementById('legend-container');
    const layerMenu = document.getElementById('layer-menu');
    const layerBtn = document.getElementById('active-day-label');
    
    closeBtn.addEventListener('click', () => {
        sidePanel.classList.remove('active');
    });

    layerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        layerMenu.classList.toggle('active');
    });

    legendToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        legendContainer.classList.add('active');
    });

    legendClose.addEventListener('click', () => {
        legendContainer.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
        if (!layerMenu.contains(e.target) && !layerBtn.contains(e.target)) {
            layerMenu.classList.remove('active');
        }
    });
}




async function loadAllLayers() {
    const layerOptions = document.getElementById('layer-options');
    layerOptions.innerHTML = ''; // Clear loading state

    for (const layerInfo of CONFIG.layers) {
        try {
            const data = await fetchGeoJSON(layerInfo.id);
            const geoJsonLayer = L.geoJSON(data, {
                style: getFeatureStyle,
                onEachFeature: (f, l) => onEachFeature(f, l, layerInfo)
            });

            layerGroups[layerInfo.key] = geoJsonLayer;
            
            // Create menu item
            const btn = document.createElement('button');
            btn.className = 'text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-colors hover:bg-white/5 cursor-pointer';
            btn.textContent = layerInfo.name;
            btn.onclick = () => switchLayer(layerInfo, geoJsonLayer);
            layerOptions.appendChild(btn);

            // Default to Day 1
            if (layerInfo.key === 'day1cat') {
                geoJsonLayer.addTo(map);
                activeLayer = geoJsonLayer;
                document.querySelector('#active-day-label span').textContent = layerInfo.name;
            }

        } catch (error) {
            console.error(`Error loading layer ${layerInfo.name}:`, error);
        }
    }
    
    // Load Live Alerts
    loadLiveAlerts();
}

async function loadLiveAlerts() {
    try {
        const events = ['Tornado Warning', 'Tornado Watch', 'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch'];
        const url = `${CONFIG.alertsApi}?event=${encodeURIComponent(events.join(','))}`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'SPC-Outlook-Dashboard (github.com/jrobinso3/SPC-Outlook)' }
        });
        
        if (!response.ok) throw new Error('Alerts fetch failed');
        const data = await response.json();
        
        // Sort features so higher priority alerts (Tornado Warnings) are drawn last/on top
        const priorityOrder = {
            'Tornado Warning': 4,
            'Severe Thunderstorm Warning': 3,
            'Tornado Watch': 2,
            'Severe Thunderstorm Watch': 1
        };
        
        data.features.sort((a, b) => {
            return (priorityOrder[a.properties.event] || 0) - (priorityOrder[b.properties.event] || 0);
        });

        if (layerGroups['alerts']) map.removeLayer(layerGroups['alerts']);
        
        const alertsLayer = L.geoJSON(data, {
            style: (feature) => {
                const props = feature.properties;
                const event = props.event;
                const color = CONFIG.alertColors[event] || '#ffffff';
                
                // Detect confirmed (observed) tornadoes
                const isConfirmed = props.parameters && 
                                   props.parameters.tornadoDetection && 
                                   props.parameters.tornadoDetection.some(v => v.toUpperCase().includes('OBSERVED'));

                const isTornadoWarning = event === 'Tornado Warning';

                return {
                    fillColor: color,
                    weight: isConfirmed ? 6 : (isTornadoWarning ? 4 : 2),
                    opacity: 1,
                    color: color,
                    fillOpacity: isConfirmed ? 0.6 : 0.4,
                    className: isConfirmed ? 'confirmed-tor' : ''
                };
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const content = `
                    <div class="popup-content max-h-64 overflow-y-auto pr-1">
                        <h4 class="text-sm font-bold" style="color: ${CONFIG.alertColors[props.event]}">${props.event}</h4>
                        <p class="text-[11px] mt-1 font-semibold text-white">${props.headline || 'Active Alert'}</p>
                        <hr class="my-2 border-white/10">
                        <div class="text-[10px] text-slate-300 leading-normal mb-2 whitespace-pre-wrap">${props.description || ''}</div>
                        <div class="text-[10px] text-slate-400 pt-2 border-t border-white/5">Expires: ${new Date(props.expires).toLocaleString()}</div>
                    </div>
                `;
                layer.bindPopup(content, { 
                    maxWidth: 280,
                    className: 'alert-popup'
                });
                
                layer.on('mouseover', function() {
                    this.setStyle({ fillOpacity: 0.7, weight: 4 });
                });
                layer.on('mouseout', function() {
                    this.setStyle({ fillOpacity: 0.4, weight: 2 });
                });
            }
        });
        
        alertsLayer.addTo(map);
        layerGroups['alerts'] = alertsLayer;
        
        // Update UI with alert counts
        updateAlertUI(data.features);
        
    } catch (error) {
        console.error('Error loading live alerts:', error);
    }
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


function switchLayer(layerInfo, layer) {
    if (activeLayer) map.removeLayer(activeLayer);
    layer.addTo(map);
    activeLayer = layer;
    document.querySelector('#active-day-label span').textContent = layerInfo.name;
    document.getElementById('layer-menu').classList.remove('active');
    
    // Ensure alerts always stay on top of the new outlook layer
    if (layerGroups['alerts']) {
        layerGroups['alerts'].bringToFront();
    }
}


async function fetchGeoJSON(layerId) {
    const url = `${CONFIG.apiBase}/${layerId}/query?where=1%3D1&outFields=*&f=geojson`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

function getFeatureStyle(feature) {
    const props = feature.properties;
    const label = (props.label || props.LABEL || '').toUpperCase();
    const color = CONFIG.colors[label] || CONFIG.colors['DEFAULT'];
    
    return {
        fillColor: color,
        weight: 1.5,
        opacity: 1,
        color: color,
        fillOpacity: 0.35
    };
}

function formatSPCDate(dateStr) {
    if (!dateStr || dateStr.length < 12) return dateStr || 'N/A';
    
    try {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(dateStr.substring(8, 10));
        const minute = parseInt(dateStr.substring(10, 12));
        
        const date = new Date(Date.UTC(year, month, day, hour, minute));
        return date.toLocaleString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            timeZoneName: 'short' 
        });
    } catch (e) {
        return dateStr;
    }
}

function localizeTimeStrings(text, baseDateStr) {
    if (!baseDateStr || baseDateStr === 'N/A' || baseDateStr.length < 8) return text;
    
    const year = parseInt(baseDateStr.substring(0, 4));
    const month = parseInt(baseDateStr.substring(4, 6)) - 1;
    let defaultDay = parseInt(baseDateStr.substring(6, 8));

    // Catch DDHHMMZ (6 digits), HHMMZ (4 digits), and HHZ (2 digits)
    const timeRegex = /\b(\d{2,6})\s?(Z|UTC)\b/g;
    
    return text.replace(timeRegex, (match, digits, tz) => {
        let day = defaultDay;
        let hour, min;
        
        if (digits.length === 6) {
            day = parseInt(digits.substring(0, 2));
            hour = parseInt(digits.substring(2, 4));
            min = parseInt(digits.substring(4, 6));
        } else if (digits.length === 4) {
            hour = parseInt(digits.substring(0, 2));
            min = parseInt(digits.substring(2, 4));
        } else {
            hour = parseInt(digits);
            min = 0;
        }
        
        if (isNaN(hour) || hour > 24) return match;

        const date = new Date(Date.UTC(year, month, day, hour, min));
        const localTime = date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        return `${localTime} (${match})`;
    });
}

function cleanDiscussionText(text, baseDateStr) {
    if (!text) return "";
    
    // First, localize Zulu/UTC times
    let processedText = localizeTimeStrings(text, baseDateStr);

    // NWS text often has hard line breaks at ~75 characters.
    const lines = processedText.split('\n');
    let paragraphs = [];
    let currentParagraph = [];

    for (let line of lines) {
// ...
        const trimmedLine = line.trim();
        
        // Check for common SPC/NWS "header" patterns (starts with dots or is short/all caps)
        const isHeader = trimmedLine.startsWith('...') || 
                         (trimmedLine.length > 0 && trimmedLine.length < 50 && trimmedLine === trimmedLine.toUpperCase() && !trimmedLine.includes(' '));
        
        if (isHeader || trimmedLine === '') {
            if (currentParagraph.length > 0) {
                paragraphs.push(currentParagraph.join(' '));
                currentParagraph = [];
            }
            if (trimmedLine !== '') {
                paragraphs.push(trimmedLine);
            }
        } else {
            currentParagraph.push(trimmedLine);
        }
    }
    
    if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
    }
    
    return paragraphs.join('\n\n');
}

function onEachFeature(feature, layer, layerInfo) {
    const props = feature.properties;
    const label = (props.label || props.LABEL || '').toUpperCase();
    const label2 = props.label2 || props.LABEL_2 || 'Convective Outlook Area';
    const valid = props.valid || props.VALID || 'N/A';
    const readableValid = formatSPCDate(valid);

    const content = `
        <div class="popup-content">
            <h4 class="text-lg font-bold mb-1" style="color: ${CONFIG.colors[label] || '#fff'}">${label || 'Outlook'}</h4>
            <p class="text-xs text-slate-300 mb-2">${label2}</p>
            <hr class="my-2 border-white/10">
            <div class="mb-3 text-[10px] text-slate-400">Expires: ${readableValid}</div>
            <button class="view-discussion-btn w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer">
                View Technical Discussion
            </button>
        </div>
    `;
    layer.bindPopup(content, {
        className: 'custom-popup',
        maxWidth: 220
    });
    
    layer.on('popupopen', function(e) {
        const btn = e.popup.getElement().querySelector('.view-discussion-btn');
        if (btn) {
            btn.onclick = (event) => {
                event.preventDefault();
                showDiscussion(layerInfo.discussion, valid);
            };
        }
    });

    layer.on('mouseover', function() {
        this.setStyle({ fillOpacity: 0.6, weight: 3 });
    });
    
    layer.on('mouseout', function() {
        this.setStyle({ fillOpacity: 0.35, weight: 1.5 });
    });
}

async function showDiscussion(type, baseDateStr) {
    const sidePanel = document.getElementById('side-panel');
    const body = document.getElementById('discussion-body');
    
    sidePanel.classList.add('active');
    body.innerHTML = '<div class="flex items-center justify-center h-40"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>';
    
    try {
        const targetUrl = `${CONFIG.discussionBase}/${type}otlk.html`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        
        // Try direct fetch first (works on localhost), then fallback to proxy (for live site)
        let response;
        try {
            response = await fetch(targetUrl);
            if (!response.ok) throw new Error();
        } catch (e) {
            response = await fetch(proxyUrl);
        }

        if (!response.ok) throw new Error('Failed to fetch discussion');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find the technical text inside <pre>
        const pre = doc.querySelector('pre');
        if (pre) {
            const processedText = cleanDiscussionText(pre.innerText, baseDateStr);
            body.innerHTML = `<pre>${processedText}</pre>`;
        } else {
            body.innerHTML = '<div class="placeholder">Technical discussion text not found for this product.</div>';
        }
    } catch (error) {
        console.error('Discussion fetch error:', error);
        body.innerHTML = '<div class="placeholder">Error loading discussion. Please try again later.</div>';
    }
}

document.addEventListener('DOMContentLoaded', initMap);
