import { state, saveAppState } from './state.js';
import { CONFIG } from './config.js';
import { switchOutlook } from './outlooks.js';
import { loadLiveAlerts } from './alerts.js';
import { loadRadar, findNearestRadar } from './radar.js';
import { toggleRadarAnimation, stopAnimation } from './radar-animation.js';
import { updateMapLegend } from './legend.js';
import { locateUser } from './map.js';

export function initUIListeners() {
    const closeBtn = document.getElementById('close-panel');
    const sidePanel = document.getElementById('side-panel');
    const legendToggle = document.getElementById('legend-toggle');
    const legendClose = document.getElementById('legend-close');
    const legendContainer = document.getElementById('legend-container');
    const layerMenu = document.getElementById('layer-menu');
    const layerBtn = document.getElementById('active-day-label');
    const locationBtn = document.getElementById('get-location');
    
    const toggleAlerts = document.getElementById('toggle-alerts');
    const toggleRadarLayer = document.getElementById('toggle-radar-layer');
    const toggleOutlooks = document.getElementById('toggle-outlooks');
    const toggleWatches = document.getElementById('toggle-watches');
    const toggleRadarSites = document.getElementById('toggle-radar-sites');

    if (locationBtn) {
        locationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            locateUser();
        });
    }

    if (toggleAlerts) toggleAlerts.checked = state.showAlerts;
    if (toggleRadarLayer) toggleRadarLayer.checked = state.showRadar;
    if (toggleOutlooks) toggleOutlooks.checked = state.showOutlooks;
    if (toggleWatches) toggleWatches.checked = state.showWatches;
    if (toggleRadarSites) toggleRadarSites.checked = state.showRadarSites;

    updateDynamicLabels();
    renderOutlookList();

    toggleAlerts?.addEventListener('change', (e) => {
        state.showAlerts = e.target.checked;
        loadLiveAlerts();
        saveAppState();
    });

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
            const map = state.map;
            if (map.getLayer('radar-raster')) map.removeLayer('radar-raster');
            if (map.getSource('radar-src')) map.removeSource('radar-src');
        }
        saveAppState();
    });

    toggleOutlooks?.addEventListener('change', (e) => {
        state.showOutlooks = e.target.checked;
        const currentLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey);
        if (state.showOutlooks) {
            if (currentLayer) switchOutlook(currentLayer);
        } else {
            const map = state.map;
            ['outlook-fill', 'outlook-border', 'sig-hatch'].forEach(id => {
                if (map.getLayer(id)) map.removeLayer(id);
            });
        }
        updateMapLegend();
        renderOutlookList();
        saveAppState();
    });

    toggleRadarSites?.addEventListener('change', (e) => {
        state.showRadarSites = e.target.checked;
        if (!state.radarMarkers) return;
        state.radarMarkers.forEach(m => {
            m.getElement().style.display = state.showRadarSites ? 'block' : 'none';
        });
        saveAppState();
    });

    // Radar Product Selection
    const productBtns = document.querySelectorAll('.radar-product-btn');
    productBtns.forEach(btn => {
        if (btn.dataset.product === state.currentRadarProduct) btn.classList.add('active');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('active')) return;
            productBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentRadarProduct = btn.dataset.product;
            saveAppState();
            if (state.activeRadarId && state.showRadar) loadRadar(state.activeRadarId);
        });
    });

    closeBtn?.addEventListener('click', () => sidePanel.classList.remove('active'));
    layerBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        layerMenu.classList.toggle('active');
    });
    legendToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        legendContainer.classList.add('active');
    });
    legendClose?.addEventListener('click', () => legendContainer.classList.remove('active'));

    document.addEventListener('click', (e) => {
        if (!layerMenu?.contains(e.target) && !layerBtn?.contains(e.target)) {
            layerMenu?.classList.remove('active');
        }
    });

    const playBtns = [
        document.getElementById('toggle-radar-animation'),
        document.getElementById('toggle-radar-animation-header')
    ];

    playBtns.forEach(btn => {
        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // If radar is off, turn it on first
            if (!state.showRadar) {
                state.showRadar = true;
                const toggleRadarLayer = document.getElementById('toggle-radar-layer');
                if (toggleRadarLayer) toggleRadarLayer.checked = true;
                
                if (state.activeRadarId) {
                    loadRadar(state.activeRadarId);
                } else {
                    findNearestRadar(true);
                }
                saveAppState();
            }

            toggleRadarAnimation();
        });
    });
}

export async function renderOutlookList() {
    const layerOptions = document.getElementById('layer-options');
    if (!layerOptions) return;
    layerOptions.innerHTML = '';

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const getDayName = (offset) => {
        const d = new Date();
        d.setDate(now.getDate() + offset);
        return dayNames[d.getDay()];
    };

    const groups = {
        'Today': CONFIG.layers.filter(l => l.key.startsWith('day1')),
        [getDayName(1)]: CONFIG.layers.filter(l => l.key.startsWith('day2')),
        [getDayName(2)]: CONFIG.layers.filter(l => l.key.startsWith('day3')),
        [getDayName(3)]: CONFIG.layers.filter(l => l.key.startsWith('day4')),
        [getDayName(4)]: CONFIG.layers.filter(l => l.key.startsWith('day5'))
    };

    for (const [groupName, layers] of Object.entries(groups)) {
        if (layers.length === 0) continue;
        const groupHeader = document.createElement('div');
        groupHeader.className = 'text-[9px] font-bold text-sky-500/50 uppercase tracking-widest mt-4 mb-1 first:mt-0 px-2 border-t border-white/5 pt-3 first:border-0 first:pt-0';
        groupHeader.textContent = groupName;
        layerOptions.appendChild(groupHeader);

        for (const layerInfo of layers) {
            const btn = document.createElement('button');
            const isActive = state.currentOutlookKey === layerInfo.key;
            btn.className = `flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-all outline-none ${
                isActive ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20' : 'hover:bg-white/5 text-slate-300 border border-transparent'
            } ${!state.showOutlooks ? 'opacity-50 pointer-events-none' : ''}`;
            
            const displayName = layerInfo.name.includes("'s ") ? layerInfo.name.split("'s ").pop() : layerInfo.name;
            btn.innerHTML = `
                <span class="text-xs font-medium">${displayName}</span>
                ${isActive ? '<div class="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]"></div>' : ''}
            `;

            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!state.showOutlooks || state.currentOutlookKey === layerInfo.key) return;
                state.currentOutlookKey = layerInfo.key;
                await switchOutlook(layerInfo);
                renderOutlookList();
                document.getElementById('layer-menu')?.classList.remove('active');
            });
            layerOptions.appendChild(btn);
        }
    }
}

function updateDynamicLabels() {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    CONFIG.layers.forEach(layer => {
        const match = layer.name.match(/Day (\d+)/i);
        if (match) {
            const targetDate = new Date();
            targetDate.setDate(now.getDate() + (parseInt(match[1]) - 1));
            layer.name = layer.name.replace(/Day \d+/i, `${dayNames[targetDate.getDay()]}'s`);
        }
    });
}
