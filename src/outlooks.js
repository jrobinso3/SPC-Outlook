import { state } from './state.js';
import { CONFIG } from './config.js';
import { formatSPCDate, cleanDiscussionText } from './utils.js';
import { updateMapLegend } from './legend.js';
import { ThemeManager } from './theme.js';
import { DataProvider } from './api.js';

export async function switchOutlook(layerInfo) {
    if (state.activeLayer) state.map.removeLayer(state.activeLayer);
    
    try {
        const outlookGroup = L.layerGroup();
        
        // 1. Fetch main probabilistic/categorical data via DataProvider
        const probData = await DataProvider.fetchOutlook(layerInfo.id);
        if (!probData) return;
        
        const probLayer = L.geoJSON(probData, {
            style: (f) => getFeatureStyle(f, layerInfo),
            pane: 'outlookPane',
            onEachFeature: (f, l) => onEachFeature(f, l, layerInfo)
        });
        outlookGroup.addLayer(probLayer);

        // Extract active categories for legend
        state.activeOutlookCategories = [...new Set(
            probData.features.map(f => f.properties.displayLabel).filter(Boolean)
        )];

        // 2. Fetch SIG (Intensity/Hatching) data
        if (layerInfo.sigLayerId) {
            try {
                const sigData = await DataProvider.fetchSigData(layerInfo.sigLayerId);
                if (sigData && sigData.features.length > 0) {
                    const sigLayer = L.geoJSON(sigData, {
                        style: getSigStyle,
                        pane: 'sigPane',
                        interactive: false
                    });
                    outlookGroup.addLayer(sigLayer);
                    
                    const sigCats = sigData.features.map(f => f.properties.label).filter(Boolean);
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

function getFeatureStyle(feature, layerInfo) {
    const color = ThemeManager.getColor(layerInfo.key, feature.properties.displayLabel);
    
    return {
        fillColor: color,
        weight: 1.5,
        opacity: 1,
        color: color,
        fillOpacity: 0.35
    };
}

function getSigStyle(feature) {
    return {
        fillColor: ThemeManager.getSigPattern(feature.properties.label),
        fillOpacity: 1,
        weight: 2,
        color: 'rgba(0,0,0,0.8)',
        interactive: false
    };
}

function onEachFeature(feature, layer, layerInfo) {
    const p = feature.properties;
    const color = ThemeManager.getColor(layerInfo.key, p.displayLabel);
    const readableValid = formatSPCDate(p.valid);
    const readableExpire = formatSPCDate(p.expire);

    const content = `
        <div class="popup-content">
            <h4 class="text-lg font-bold mb-2" style="color: ${color}">${p.label2}</h4>
            <hr class="my-2 border-white/10">
            <div class="mb-3 text-[10px] text-slate-400">Valid: ${readableValid} - ${readableExpire}</div>
            <button class="view-discussion-btn w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer">
                View Technical Discussion
            </button>
        </div>
    `;
    
    layer.bindPopup(content, { className: 'custom-popup', maxWidth: 220 });
    
    layer.on('popupopen', (e) => {
        const btn = e.popup.getElement().querySelector('.view-discussion-btn');
        if (btn) btn.onclick = (ev) => {
            ev.preventDefault();
            showDiscussion(layerInfo.discussion, p.valid);
        };
    });

    layer.on('mouseover', function() { this.setStyle({ fillOpacity: 0.6, weight: 3 }); });
    layer.on('mouseout', function() { this.setStyle({ fillOpacity: 0.35, weight: 1.5 }); });
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
        const pre = new DOMParser().parseFromString(html, 'text/html').querySelector('pre');
        
        if (pre) {
            body.innerHTML = `<pre>${cleanDiscussionText(pre.innerText, baseDateStr)}</pre>`;
        } else {
            body.innerHTML = '<div class="placeholder">Technical discussion text not found for this product.</div>';
        }
    } catch (error) {
        console.error('Discussion fetch error:', error);
        body.innerHTML = '<div class="placeholder">Error loading discussion. Please try again later.</div>';
    }
}

