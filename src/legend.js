import { state } from './state.js';
import { CONFIG } from './config.js';

export function updateMapLegend() {
    const legendItems = document.getElementById('legend-items');
    const legendTitle = document.getElementById('legend-title');
    if (!legendItems) return;

    legendItems.innerHTML = '';
    
    // 1. Handle SPC Outlooks
    if (state.showOutlooks) {
        const currentLayer = CONFIG.layers.find(l => l.key === state.currentOutlookKey);
        if (currentLayer) {
            appendOutlookLegend(legendItems, currentLayer);
        }
    }

    // 2. Handle Severe Weather (Warnings/Watches)
    if (state.showAlerts || state.showWatches) {
        appendAlertLegend(legendItems);
    }

    // Handle Title visibility
    if (legendItems.children.length === 0) {
        if (legendTitle) legendTitle.classList.add('hidden');
    } else {
        if (legendTitle) legendTitle.classList.remove('hidden');
    }
}

function appendOutlookLegend(container, layerInfo) {
    const active = state.activeOutlookCategories;
    if (active.length === 0) return;

    const header = document.createElement('div');
    header.className = 'col-span-full text-[10px] font-bold text-blue-400 uppercase tracking-tight mb-1 mt-2 first:mt-0';
    header.textContent = layerInfo.name;
    container.appendChild(header);

    const categories = layerInfo.key.includes('cat')
        ? ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT', 'HIGH']
        : ['0.02', '0.05', '0.10', '0.15', '15%', '30%', '45%', '60%'];

    categories.filter(cat => active.includes(cat)).forEach(cat => {
        const color = CONFIG.colors[cat] || CONFIG.colors.DEFAULT;
        const colorClass = cat.match(/^[A-Z]+$/) ? `bg-spc-${cat.toLowerCase()}` : '';
        const item = createLegendItem(cat, color, colorClass);
        container.appendChild(item);
    });

    // 2. Handle Intensity (SIG) levels
    const sigLevels = [
        { key: 'CIG1', label: 'SIG Level 1', pattern: 'url(#pattern-cig1)' },
        { key: 'CIG2', label: 'SIG Level 2', pattern: 'url(#pattern-cig2)' },
        { key: 'CIG3', label: 'SIG Level 3', pattern: 'url(#pattern-cig3)' }
    ];

    sigLevels.filter(sig => active.includes(sig.key)).forEach(sig => {
        const item = createLegendItem(sig.label, sig.pattern, '', false, null, true);
        container.appendChild(item);
    });
}

function appendAlertLegend(container) {
    const activeTypes = state.activeAlertTypes;
    if (activeTypes.length === 0) return;

    const hasWarnings = state.showAlerts && activeTypes.some(t => t.includes('Warning'));
    const hasWatches = state.showWatches && activeTypes.some(t => t.includes('Watch'));
    if (!hasWarnings && !hasWatches) return;

    // Check active warning layers for PDS/Emergency subtypes
    const warningFeatures = [];
    state.activeAlertsLayer?.eachLayer(layer => {
        layer.eachLayer?.((l) => {
            if (l.feature) warningFeatures.push(l.feature);
        });
    });
    const hasEmergency = warningFeatures.some(f => {
        const desc = (f.properties.description || '').toUpperCase();
        const headline = (f.properties.headline || '').toUpperCase();
        return desc.includes('TORNADO EMERGENCY') || headline.includes('EMERGENCY');
    });
    const hasPDS = warningFeatures.some(f => {
        const desc = (f.properties.description || '').toUpperCase();
        const headline = (f.properties.headline || '').toUpperCase();
        return desc.includes('PARTICULARLY DANGEROUS SITUATION') || headline.includes('PDS');
    });

    const header = document.createElement('div');
    header.className = 'col-span-full text-[10px] font-bold text-red-400 uppercase tracking-tight mb-1 mt-3';
    header.textContent = 'Severe Weather';
    container.appendChild(header);

    const counts = state.alertCounts;
    const alerts = [
        { label: 'TOR Emergency',     color: '#ff00ff', isPDS: true,  show: hasWarnings && hasEmergency,                                          count: null },
        { label: 'TOR Warning (PDS)', color: '#8b0000', isPDS: true,  show: hasWarnings && hasPDS,                                                count: null },
        { label: 'Tornado Warning',   color: '#ff0000', isPDS: false, show: hasWarnings && activeTypes.includes('Tornado Warning'),                count: counts['Tornado Warning'] },
        { label: 'Tornado Watch',     color: '#ffff00', isPDS: false, show: hasWatches  && activeTypes.includes('Tornado Watch'),                  count: counts['Tornado Watch'] },
        { label: 'SVR Warning',       color: '#ffa500', isPDS: false, show: hasWarnings && activeTypes.includes('Severe Thunderstorm Warning'),    count: counts['Severe Thunderstorm Warning'] },
        { label: 'SVR Watch',         color: '#db7093', isPDS: false, show: hasWatches  && activeTypes.includes('Severe Thunderstorm Watch'),      count: counts['Severe Thunderstorm Watch'] },
    ];

    alerts.filter(a => a.show).forEach(alert => {
        container.appendChild(createLegendItem(alert.label, alert.color, '', alert.isPDS, alert.count));
    });
}

function createLegendItem(label, color, colorClass, isPDS = false, count = null, isPattern = false) {
    const item = document.createElement('div');
    item.className = 'flex items-center gap-2.5';

    const boxStyle = `
        width: 14px;
        height: 14px;
        ${isPattern ? `background: #334155;` : (!colorClass ? `background-color: ${color} !important;` : '')}
        border: 1.5px solid rgba(255,255,255,0.2);
        border-radius: 3px;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
    `;

    // If it's a pattern, we need to use an SVG to render it in the legend box
    const patternBox = isPattern ? `
        <svg width="100%" height="100%" style="display:block">
            <rect width="100%" height="100%" fill="${color}" />
        </svg>
    ` : '';

    const innerLine = isPDS ? '<div style="position: absolute; top: 50%; left: 0; right: 0; height: 1.5px; background: white; transform: translateY(-50%); opacity: 0.8;"></div>' : '';
    const countBadge = count != null ? `<span style="color:${color}" class="ml-auto text-[11px] font-bold">${count}</span>` : '';

    item.innerHTML = `
        <div class="${colorClass}" style="${boxStyle}">
            ${patternBox}
            ${innerLine}
        </div>
        <span class="text-[11px] text-slate-200 font-bold uppercase tracking-tight">${label}</span>
        ${countBadge}
    `;
    return item;
}
