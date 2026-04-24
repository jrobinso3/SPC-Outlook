/**
 * Global application state and persistence
 */

export const state = {
    map: null,
    activeLayer: null,
    layerGroups: {},
    
    // Master visibility states
    showRadar: true,
    showAlerts: true,
    showOutlooks: true,
    
    currentOutlookKey: 'day1cat',
    currentRadarProduct: 'sr_bref',
    
    activeAlertsLayer: null,
    
    // Radar state variables
    radarSites: [],
    radarSitesLayer: null,
    activeRadarLayer: null,
    pendingRadarLayer: null,
    activeRadarId: null
};

export function saveAppState() {
    if (!state.map) return;
    const persistence = {
        center: state.map.getCenter(),
        zoom: state.map.getZoom(),
        showRadar: state.showRadar,
        showAlerts: state.showAlerts,
        showOutlooks: state.showOutlooks,
        currentOutlookKey: state.currentOutlookKey,
        currentRadarProduct: state.currentRadarProduct,
        activeRadarId: state.activeRadarId
    };
    localStorage.setItem('spc_dashboard_state', JSON.stringify(persistence));
}

export function loadAppState() {
    try {
        const saved = localStorage.getItem('spc_dashboard_state');
        if (!saved) return null;
        
        const parsed = JSON.parse(saved);
        
        // Sync back to state object
        state.showRadar = parsed.showRadar ?? true;
        state.showAlerts = parsed.showAlerts ?? true;
        state.showOutlooks = parsed.showOutlooks ?? true;
        state.currentOutlookKey = parsed.currentOutlookKey || 'day1cat';
        state.currentRadarProduct = parsed.currentRadarProduct || 'sr_bref';
        state.activeRadarId = parsed.activeRadarId || null;
        
        return parsed;
    } catch (e) {
        console.error('Error loading saved state:', e);
        return null;
    }
}
