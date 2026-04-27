import { state } from './state.js';
import { getFirstLabelLayerId } from './map.js';

export const animationState = {
    frames: [],
    currentIndex: 0,
    isPlaying: false,
    interval: null,
    windowMinutes: 30,
    frameDelay: 500,
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

    animationState.isPlaying = true;
    const map = state.map;

    // Remove static radar
    if (map.getLayer('radar-raster')) map.setLayoutProperty('radar-raster', 'visibility', 'none');

    const station = state.activeRadarId.toLowerCase();
    const layerName = `${station}_${state.currentRadarProduct}`;
    const beforeId = getFirstLabelLayerId(map);

    // Fetch timestamps
    const cutoff = Date.now() - animationState.windowMinutes * 60 * 1000;
    let timestamps = [];
    try {
        const all = await fetchAvailableTimestamps(station, layerName);
        timestamps = all.filter(t => new Date(t).getTime() >= cutoff);
    } catch (e) {
        console.warn('Animation timestamps failed:', e);
    }

    if (timestamps.length === 0) {
        const now = Date.now();
        for (let i = 4; i >= 0; i--) timestamps.push(new Date(now - i * 7 * 60 * 1000).toISOString());
    }

    // Create frames (Sources and Layers)
    animationState.frames = timestamps.map((timeStr, idx) => {
        const id = `radar-frame-${idx}`;
        const wmsUrl = `https://opengeo.ncep.noaa.gov/geoserver/${station}/${layerName}/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layerName}&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=256&HEIGHT=256&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&TIME=${timeStr}`;
        
        map.addSource(id, { type: 'raster', tiles: [wmsUrl], tileSize: 256 });
        map.addLayer({
            id: id,
            type: 'raster',
            source: id,
            paint: { 'raster-opacity': 0 },
            layout: { 'visibility': 'visible' }
        }, beforeId);
        
        return { id, time: timeStr };
    });

    animationState.frameDelay = Math.round(2000 / animationState.frames.length);
    animationState.currentIndex = 0;
    
    if (animationState.frames.length > 0) {
        map.setPaintProperty(animationState.frames[0].id, 'raster-opacity', 0.8);
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

    const map = state.map;
    animationState.frames.forEach(frame => {
        if (map.getLayer(frame.id)) map.removeLayer(frame.id);
        if (map.getSource(frame.id)) map.removeSource(frame.id);
    });
    animationState.frames = [];

    if (state.showRadar && state.activeRadarId && !isSwitching) {
        if (map.getLayer('radar-raster')) map.setLayoutProperty('radar-raster', 'visibility', 'visible');
    }
    
    updateUI(false);
}

function animateFrame() {
    if (!animationState.isPlaying || animationState.frames.length === 0 || !state.showRadar) return;

    const map = state.map;
    const prevFrame = animationState.frames[animationState.currentIndex];
    if (prevFrame && map.getLayer(prevFrame.id)) {
        map.setPaintProperty(prevFrame.id, 'raster-opacity', 0);
    }

    animationState.currentIndex = (animationState.currentIndex + 1) % animationState.frames.length;
    
    const nextFrame = animationState.frames[animationState.currentIndex];
    if (nextFrame && map.getLayer(nextFrame.id)) {
        map.setPaintProperty(nextFrame.id, 'raster-opacity', 0.8);
        const timeEl = document.getElementById('radar-timestamp');
        if (timeEl) timeEl.textContent = new Date(nextFrame.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            btn.classList.add('bg-sky-500/20', 'text-sky-400');
        } else {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z"/></svg>';
            btn.classList.remove('bg-sky-500/20', 'text-sky-400');
        }
    });
}
