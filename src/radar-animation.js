import { state } from './state.js';

export const animationState = {
    frames: [],
    currentIndex: 0,
    isPlaying: false,
    interval: null,
    windowMinutes: 30, // How far back to look for frames
    frameDelay: 500,   // ms per frame — recalculated at start to keep total loop = 2s
};

export async function toggleRadarAnimation() {
    if (animationState.isPlaying) {
        stopAnimation();
    } else {
        await startAnimation();
    }
}

async function fetchAvailableTimestamps(station, layerName) {
    const url = `https://opengeo.ncep.noaa.gov/geoserver/${station}/${layerName}/ows?service=WMS&request=GetCapabilities`;
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const dimension = xml.querySelector('Dimension[name="time"]');
    if (!dimension) return [];
    return dimension.textContent.trim().split(',').map(s => s.trim()).filter(Boolean);
}

async function startAnimation() {
    if (!state.activeRadarId || !state.showRadar) return;

    // Set state first to prevent race conditions
    animationState.isPlaying = true;

    // Hide static radar layer
    if (state.activeRadarLayer) {
        state.map.removeLayer(state.activeRadarLayer);
        state.activeRadarLayer = null;
    }
    if (state.pendingRadarLayer) {
        state.map.removeLayer(state.pendingRadarLayer);
        state.pendingRadarLayer = null;
    }

    const station = state.activeRadarId.toLowerCase();
    const layerName = `${station}_${state.currentRadarProduct}`;

    // Fetch real scan timestamps from the service
    const cutoff = Date.now() - animationState.windowMinutes * 60 * 1000;
    let timestamps = [];
    try {
        const all = await fetchAvailableTimestamps(station, layerName);
        timestamps = all.filter(t => new Date(t).getTime() >= cutoff);
    } catch (e) {
        console.warn('GetCapabilities failed, falling back to estimated timestamps:', e);
    }

    // Fallback: estimated timestamps at 7-min intervals if fetch failed
    if (timestamps.length === 0) {
        const now = Date.now();
        const count = Math.ceil(animationState.windowMinutes / 7);
        for (let i = count - 1; i >= 0; i--) {
            timestamps.push(new Date(now - i * 7 * 60 * 1000).toISOString());
        }
    }

    // Load frames
    animationState.frames = timestamps.map(timeStr => {
        // NOTE: Use workspace/layer-specific endpoint, NOT the global /geoserver/ows endpoint.
        // The global endpoint returns XML ServiceExceptions for these layers, causing CORB errors
        // and blank radar tiles. Keep URL as /geoserver/${station}/${layerName}/ows with layers: layerName.
        const frame = L.tileLayer.wms(`https://opengeo.ncep.noaa.gov/geoserver/${station}/${layerName}/ows`, {
            layers: layerName,
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            pane: 'radarPane',
            opacity: 0,
            time: timeStr,
            maxZoom: 20,
            maxNativeZoom: 18
        });
        frame.options.fadeAnimation = false;
        return frame;
    });

    // Add all frames to map
    animationState.frames.forEach(frame => frame.addTo(state.map));

    // Scale frame delay so total loop = 2 seconds regardless of frame count
    animationState.frameDelay = Math.round(2000 / animationState.frames.length);

    // Start loop
    animationState.currentIndex = 0;
    if (animationState.frames.length > 0) {
        animationState.frames[0].setOpacity(0.8); // Show first frame immediately
    }
    animationState.interval = setInterval(animateFrame, animationState.frameDelay);
    
    updateUI(true);
}

export function stopAnimation(isSwitching = false) {
    animationState.isPlaying = false;
    if (animationState.interval) {
        clearInterval(animationState.interval);
        animationState.interval = null;
    }

    // Remove all frames from map and clear array
    animationState.frames.forEach(frame => {
        if (state.map.hasLayer(frame)) {
            state.map.removeLayer(frame);
        }
    });
    animationState.frames = [];

    // Restore static radar if main toggle is still ON and we aren't already switching to it
    if (state.showRadar && state.activeRadarId && !isSwitching) {
        setTimeout(() => {
            import('./radar.js').then(m => m.loadRadar(state.activeRadarId));
        }, 50);
    }
    
    updateUI(false);
}

function animateFrame() {
    if (!animationState.isPlaying || animationState.frames.length === 0 || !state.showRadar) {
        if (!state.showRadar && animationState.isPlaying) stopAnimation();
        return;
    }

    // Hide previous frame
    const prevFrame = animationState.frames[animationState.currentIndex];
    if (prevFrame) prevFrame.setOpacity(0);

    // Show next frame
    animationState.currentIndex = (animationState.currentIndex + 1) % animationState.frames.length;
    const nextFrame = animationState.frames[animationState.currentIndex];
    if (nextFrame) {
        nextFrame.setOpacity(0.8);
        
        // Update timestamp display
        const timeStr = nextFrame.options.time;
        if (timeStr) {
            const date = new Date(timeStr);
            const timeEl = document.getElementById('radar-timestamp');
            if (timeEl) {
                timeEl.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }
    }
}

function updateUI(playing) {
    const btns = [
        document.getElementById('toggle-radar-animation'),
        document.getElementById('toggle-radar-animation-header')
    ];
    
    btns.forEach(btn => {
        if (!btn) return;
        if (playing) {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            btn.classList.add('bg-blue-500/20', 'text-blue-400');
        } else {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z"/></svg>';
            btn.classList.remove('bg-blue-500/20', 'text-blue-400');
        }
    });

    // Update station name and visibility
    const container = document.getElementById('radar-timestamp-container');
    if (playing && state.activeRadarId) {
        const stationEl = document.getElementById('radar-station-name');
        if (stationEl) {
            const site = state.radarSites.find(s => s.id === state.activeRadarId);
            stationEl.textContent = `${state.activeRadarId} ${site ? `(${site.city})` : ''}`;
        }
    }
}
