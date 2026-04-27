import { state } from './state.js';
import { CONFIG } from './config.js';
import { formatSPCDate, cleanDiscussionText } from './utils.js';
import { updateMapLegend } from './legend.js';
import { ThemeManager } from './theme.js';
import { DataProvider } from './api.js';
import { getLayerAnchor } from './map.js';

export async function switchOutlook(layerInfo) {
    const map = state.map;
    if (!map) return;

    // Remove existing outlook layers and sources
    if (map.getLayer('outlook-fill')) map.removeLayer('outlook-fill');
    if (map.getLayer('outlook-border')) map.removeLayer('outlook-border');
    if (map.getLayer('sig-hatch')) map.removeLayer('sig-hatch');
    if (map.getSource('outlooks')) map.removeSource('outlooks');
    if (map.getSource('sig-data')) map.removeSource('sig-data');

    try {
        // 1. Fetch main probabilistic/categorical data
        const probData = await DataProvider.fetchOutlook(layerInfo.id);
        if (!probData) return;

        const beforeId = getLayerAnchor('outlooks');

        map.addSource('outlooks', {
            type: 'geojson',
            data: probData
        });

        // Add fill layer
        map.addLayer({
            id: 'outlook-fill',
            type: 'fill',
            source: 'outlooks',
            paint: {
                'fill-color': ['get', 'color'], // Use color property added by DataProvider normalization if available
                'fill-opacity': 0.35
            }
        }, beforeId);

        // Update fill colors based on theme if not in properties
        const categories = [...new Set(probData.features.map(f => f.properties.displayLabel).filter(Boolean))];
        state.activeOutlookCategories = categories;

        // Custom paint expression for category colors
        const colorExpression = ['match', ['get', 'displayLabel']];
        categories.forEach(cat => {
            colorExpression.push(cat, ThemeManager.getColor(layerInfo.key, cat));
        });
        colorExpression.push('rgba(0,0,0,0)'); // fallback

        map.setPaintProperty('outlook-fill', 'fill-color', colorExpression);

        // Add border layer
        map.addLayer({
            id: 'outlook-border',
            type: 'line',
            source: 'outlooks',
            paint: {
                'line-color': colorExpression,
                'line-width': 1.5
            }
        }, beforeId);

        // 2. Handle SIG (Intensity)
        if (layerInfo.sigLayerId) {
            try {
                const sigData = await DataProvider.fetchSigData(layerInfo.sigLayerId);
                if (sigData && sigData.features.length > 0) {
                    map.addSource('sig-data', { type: 'geojson', data: sigData });
                    
                    // For now, use a dark semi-transparent fill for SIG instead of complex SVG hatching
                    map.addLayer({
                        id: 'sig-hatch',
                        type: 'fill',
                        source: 'sig-data',
                        paint: {
                            'fill-color': 'rgba(0,0,0,0.15)',
                            'fill-outline-color': 'rgba(0,0,0,0.8)'
                        }
                    }, beforeId);

                    const sigCats = sigData.features.map(f => f.properties.label).filter(Boolean);
                    state.activeOutlookCategories.push(...sigCats);
                }
            } catch (e) {
                console.warn(`Sig layer failed for ${layerInfo.name}:`, e);
            }
        }

        // 3. Setup Click Handlers (Popups) - Handled centrally by map.js
        updateMapLegend();
    } catch (error) {
        console.error(`Error switching outlook to ${layerInfo.name}:`, error);
    }
}

/**
 * Handles clicks on outlook layers
 */
export function handleOutlookClick(e, feature) {
    const map = state.map;
    const layerInfo = CONFIG.layers.find(l => l.key === state.currentOutlookKey);
    if (!layerInfo) return;

    const p = feature.properties;
    const color = ThemeManager.getColor(layerInfo.key, p.displayLabel);
    const readableValid = formatSPCDate(p.valid);
    const readableExpire = formatSPCDate(p.expire);

    const content = `
        <div class="popup-content">
            <h4 class="text-lg font-bold mb-2" style="color: ${color}">${p.label2 || 'SPC Outlook'}</h4>
            <hr class="my-2 border-white/10">
            <div class="mb-3 text-[10px] text-slate-400">Valid: ${readableValid} - ${readableExpire}</div>
            <button id="spc-discussion-btn" class="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer">
                View Technical Discussion
            </button>
        </div>
    `;

    new maplibregl.Popup({ className: 'custom-popup', maxWidth: '220px' })
        .setLngLat(e.lngLat)
        .setHTML(content)
        .addTo(map);

    // Handle discussion button click
    setTimeout(() => {
        const btn = document.getElementById('spc-discussion-btn');
        if (btn) btn.onclick = () => showDiscussion(layerInfo.discussion, p.valid);
    }, 0);
}

async function showDiscussion(type, baseDateStr) {
    const sidePanel = document.getElementById('side-panel');
    const body = document.getElementById('discussion-body');
    if (!sidePanel || !body) return;
    
    sidePanel.classList.add('active');
    body.innerHTML = '<div class="flex items-center justify-center h-40"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div></div>';
    
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
