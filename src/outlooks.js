import { state } from './state.js';
import { CONFIG } from './config.js';
import { fetchGeoJSON, formatSPCDate, cleanDiscussionText } from './utils.js';

export async function switchOutlook(layerInfo) {
    if (state.activeLayer) state.map.removeLayer(state.activeLayer);
    
    try {
        const url = `${CONFIG.apiBase}/${layerInfo.id}/query?where=1%3D1&outFields=*&f=geojson`;
        const data = await fetchGeoJSON(url);
        
        state.activeLayer = L.geoJSON(data, {
            style: getFeatureStyle,
            pane: 'outlookPane',
            onEachFeature: (f, l) => onEachFeature(f, l, layerInfo)
        });

        if (state.showOutlooks) state.activeLayer.addTo(state.map);
        
        updateLegend(layerInfo);
    } catch (error) {
        console.error(`Error switching outlook to ${layerInfo.name}:`, error);
    }
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

function updateLegend(layerInfo) {
    const legendItems = document.getElementById('legend-items');
    const legendTitle = document.getElementById('legend-title');
    if (!legendItems) return;
    
    legendItems.innerHTML = '';
    legendTitle.textContent = layerInfo.name;

    const categories = layerInfo.key.includes('cat') 
        ? ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT', 'HIGH']
        : ['0.02', '0.05', '0.10', '0.15', '15%', '30%', '45%', '60%'];

    categories.forEach(cat => {
        const color = CONFIG.colors[cat] || CONFIG.colors.DEFAULT;
        const colorClass = cat.match(/^[A-Z]+$/) ? `bg-spc-${cat.toLowerCase()}` : '';
        const item = document.createElement('div');
        
        item.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 6px;
        `;

        item.innerHTML = `
            <div class="${colorClass}" style="
                width: 14px; 
                height: 14px; 
                ${!colorClass ? `background-color: ${color} !important;` : ''}
                border: 1.5px solid rgba(255,255,255,0.2); 
                border-radius: 3px;
                flex-shrink: 0;
            "></div>
            <span style="
                font-size: 11px; 
                color: #f1f5f9; 
                font-weight: 600; 
                text-transform: uppercase; 
                letter-spacing: 0.025em;
            ">${cat}</span>
        `;
        legendItems.appendChild(item);
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
