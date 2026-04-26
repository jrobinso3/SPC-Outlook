import { state } from './state.js';
import { CONFIG } from './config.js';
import { fetchGeoJSON, formatSPCDate, cleanDiscussionText } from './utils.js';
import { updateMapLegend } from './legend.js';

export async function switchOutlook(layerInfo) {
    if (state.activeLayer) state.map.removeLayer(state.activeLayer);
    
    try {
        // Create a group to hold both Prob and SIG (hatching) layers
        const outlookGroup = L.layerGroup();
        
        // 1. Fetch main probabilistic/categorical data
        const probUrl = `${CONFIG.apiBase}/${layerInfo.id}/query?where=1%3D1&outFields=*&f=geojson`;
        const probData = await fetchGeoJSON(probUrl);
        
        const probLayer = L.geoJSON(probData, {
            style: getFeatureStyle,
            pane: 'outlookPane',
            onEachFeature: (f, l) => onEachFeature(f, l, layerInfo)
        });
        outlookGroup.addLayer(probLayer);

        state.activeOutlookCategories = [...new Set(
            probData.features.map(f => (f.properties.label || f.properties.LABEL || '').toUpperCase()).filter(Boolean)
        )];

        // 2. Fetch SIG (Intensity/Hatching) data if applicable
        if (layerInfo.sigLayerId) {
            try {
                const sigUrl = `${CONFIG.apiBase}/${layerInfo.sigLayerId}/query?where=label+IN+('CIG1','CIG2','CIG3')&outFields=*&f=geojson`;
                const sigData = await fetchGeoJSON(sigUrl);
                
                if (sigData.features.length > 0) {
                    const sigLayer = L.geoJSON(sigData, {
                        style: getSigStyle,
                        pane: 'sigPane',
                        interactive: false // Let the prob layer handle interactions
                    });
                    outlookGroup.addLayer(sigLayer);
                    
                    // Add SIG levels to active categories for legend
                    const sigCats = sigData.features.map(f => f.properties.label || f.properties.LABEL).filter(Boolean);
                    state.activeOutlookCategories.push(...sigCats);
                }
            } catch (e) {
                console.warn(`Sig layer fetch failed for ${layerInfo.name}:`, e);
            }
        }

        state.activeLayer = outlookGroup;
        if (state.showOutlooks) state.activeLayer.addTo(state.map);

        updateMapLegend();
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

function getSigStyle(feature) {
    const props = feature.properties;
    const label = (props.label || props.LABEL || '').toUpperCase();
    
    // Map CIG labels to our SVG patterns
    const patternMap = {
        'CIG1': 'url(#pattern-cig1)',
        'CIG2': 'url(#pattern-cig2)',
        'CIG3': 'url(#pattern-cig3)'
    };

    return {
        fillColor: patternMap[label] || 'transparent',
        fillOpacity: 1,
        weight: 2,
        color: 'rgba(0,0,0,0.8)',
        interactive: false
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


async function showDiscussion(type, baseDateStr) {
    const sidePanel = document.getElementById('side-panel');
    const body = document.getElementById('discussion-body');
    
    if (!sidePanel || !body) return;
    
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
