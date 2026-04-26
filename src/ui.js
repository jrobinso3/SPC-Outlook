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
    if (!layerOptions) return;
    layerOptions.innerHTML = '';

    const groups = {
        'Day 1': CONFIG.layers.filter(l => l.key.startsWith('day1')),
        'Day 2': CONFIG.layers.filter(l => l.key.startsWith('day2')),
        'Day 3': CONFIG.layers.filter(l => l.key.startsWith('day3')),
        'Extended': CONFIG.layers.filter(l => l.key.startsWith('day4') || l.key.startsWith('day5'))
    };

    for (const [groupName, layers] of Object.entries(groups)) {
        if (layers.length === 0) continue;

        const groupHeader = document.createElement('div');
        groupHeader.className = 'text-[9px] font-bold text-blue-500/50 uppercase tracking-widest mt-3 mb-1 first:mt-0 px-2';
        groupHeader.textContent = groupName;
        layerOptions.appendChild(groupHeader);

        for (const layerInfo of layers) {
            const btn = document.createElement('button');
            const isActive = state.currentOutlookKey === layerInfo.key;
            
            btn.className = `flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-all outline-none ${
                isActive ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'hover:bg-white/5 text-slate-300 border border-transparent'
            } ${!state.showOutlooks ? 'opacity-50 pointer-events-none' : ''}`;
            
            // Clean up name (remove Day X prefix for inner list)
            const displayName = layerInfo.name.replace(/Day \d+ /i, '');

            btn.innerHTML = `
                <span class="text-xs font-medium">${displayName}</span>
                ${isActive ? '<div class="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>' : ''}
            `;

            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!state.showOutlooks || isActive) return;
                
                state.currentOutlookKey = layerInfo.key;
                await switchOutlook(layerInfo);
                renderOutlookList();
                
                // Close menu after selection
                const layerMenu = document.getElementById('layer-menu');
                layerMenu?.classList.remove('active');
            });
            layerOptions.appendChild(btn);
        }
    }
}
