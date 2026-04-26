import { state, saveAppState } from './state.js';
import { CONFIG } from './config.js';
import { switchOutlook } from './outlooks.js';
import { loadLiveAlerts } from './alerts.js';
import { loadRadar, findNearestRadar } from './radar.js';
import { toggleRadarAnimation, stopAnimation } from './radar-animation.js';
import { updateMapLegend } from './legend.js';

export function initUIListeners() {
    const closeBtn = document.getElementById('close-panel');
    const sidePanel = document.getElementById('side-panel');
    const legendToggle = document.getElementById('legend-toggle');
    const legendClose = document.getElementById('legend-close');
    const legendContainer = document.getElementById('legend-container');
    const layerMenu = document.getElementById('layer-menu');
    const layerBtn = document.getElementById('active-day-label');
    
    // Toggles
    const toggleAlerts = document.getElementById('toggle-alerts');
    const toggleRadarLayer = document.getElementById('toggle-radar-layer');
    const toggleOutlooks = document.getElementById('toggle-outlooks');

    // Sync Toggles with loaded state
    if (toggleAlerts) toggleAlerts.checked = state.showAlerts;
    if (toggleRadarLayer) toggleRadarLayer.checked = state.showRadar;
    if (toggleOutlooks) toggleOutlooks.checked = state.showOutlooks;

    renderOutlookList();

    toggleAlerts?.addEventListener('change', (e) => {
        state.showAlerts = e.target.checked;
        loadLiveAlerts();
        saveAppState();
    });

    const toggleWatches = document.getElementById('toggle-watches');
    toggleWatches?.addEventListener('change', (e) => {
        state.showWatches = e.target.checked;
        loadLiveAlerts();
        saveAppState();
    });

    toggleRadarLayer?.addEventListener('change', (e) => {
        state.showRadar = e.target.checked;
        if (state.showRadar) {
            if (state.activeRadarId) loadRadar(state.activeRadarId);
            else findNearestRadar(true);
        } else {
            stopAnimation();
            if (state.activeRadarLayer) {
                state.map.removeLayer(state.activeRadarLayer);
                state.activeRadarLayer = null;
            }
            if (state.pendingRadarLayer) {
                state.map.removeLayer(state.pendingRadarLayer);
                state.pendingRadarLayer = null;
            }
        }
        saveAppState();
    });

    toggleOutlooks?.addEventListener('change', (e) => {
        state.showOutlooks = e.target.checked;
        const currentLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey);

        if (state.showOutlooks) {
            if (currentLayer) switchOutlook(currentLayer);
        } else {
            if (state.activeLayer) state.map.removeLayer(state.activeLayer);
        }
        updateMapLegend();
        saveAppState();
    });

    // Radar Product Selection
    const productBtns = document.querySelectorAll('.radar-product-btn');
    productBtns.forEach(btn => {
        if (btn.dataset.product === state.currentRadarProduct) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('active')) return;

            productBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentRadarProduct = btn.dataset.product;
            
            saveAppState();
            
            if (state.activeRadarId && state.showRadar) {
                loadRadar(state.activeRadarId);
            }
        });
    });

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

    const toggleRadarBtn = document.getElementById('toggle-radar-sites');
    const radarStatusDot = document.getElementById('radar-sites-status');
    
    toggleRadarBtn.addEventListener('click', () => {
        if (state.map.hasLayer(state.radarSitesLayer)) {
            state.map.removeLayer(state.radarSitesLayer);
            radarStatusDot.classList.replace('bg-blue-500', 'bg-slate-500');
        } else {
            state.radarSitesLayer.addTo(state.map);
            radarStatusDot.classList.replace('bg-slate-500', 'bg-blue-500');
        }
    });

    const toggleAnimationBtn = document.getElementById('toggle-radar-animation');
    toggleAnimationBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRadarAnimation();
    });

    const toggleAnimationHeaderBtn = document.getElementById('toggle-radar-animation-header');
    toggleAnimationHeaderBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRadarAnimation();
    });
}

export async function renderOutlookList() {
    const layerOptions = document.getElementById('layer-options');
    layerOptions.innerHTML = '';

    for (const layerInfo of CONFIG.layers) {
        const btn = document.createElement('button');
        btn.className = `flex items-center justify-between w-full p-2 rounded-xl text-left transition-all ${
            state.currentOutlookKey === layerInfo.key ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5 text-slate-300'
        } ${!state.showOutlooks ? 'opacity-50 pointer-events-none' : ''}`;
        
        btn.innerHTML = `
            <span class="text-sm font-medium">${layerInfo.name}</span>
            ${state.currentOutlookKey === layerInfo.key ? '<div class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>' : ''}
        `;

        btn.onclick = async () => {
            if (!state.showOutlooks) return;
            state.currentOutlookKey = layerInfo.key;
            await switchOutlook(layerInfo);
            renderOutlookList();
        };
        layerOptions.appendChild(btn);
    }
}
