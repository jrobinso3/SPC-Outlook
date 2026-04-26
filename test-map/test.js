
const CONFIG = {
    colors: {
        'TSTM': '#c1e9aa',
        'MRGL': '#008b00',
        'SLGT': '#ffff00',
        'ENH': '#ffa500',
        'MDT': '#ff0000',
        'HIGH': '#ff00ff',
        'DEFAULT': '#3b82f6'
    }
};

const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([38.5, -96], 6);

// Create custom panes to match main app exactly
map.createPane('outlookPane');
map.getPane('outlookPane').style.zIndex = 350;

map.createPane('radarPane');
map.getPane('radarPane').style.zIndex = 450;

map.createPane('alertPane');
map.getPane('alertPane').style.zIndex = 550;

map.createPane('labelsPane');
map.getPane('labelsPane').style.zIndex = 700;
map.getPane('labelsPane').style.pointerEvents = 'none';

// --- BASE LAYERS ---

// 1. Dark mode base tiles (No Labels)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// 2. Major Roads & Reference Labels overlay (Top - in labelsPane)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
    pane: 'labelsPane',
    maxZoom: 20,
    opacity: 0.5
}).addTo(map);

// Apply the same visual filter as the live map
map.getPane('labelsPane').style.filter = 'brightness(0.8) contrast(1.1)';

/**
 * Creates a rectangle centered at [lat, lng]
 */
function createBox(lat, lng, sizeLat = 0.5, sizeLng = 0.8) {
    return [
        [lat - sizeLat, lng - sizeLng],
        [lat + sizeLat, lng - sizeLng],
        [lat + sizeLat, lng + sizeLng],
        [lat - sizeLat, lng + sizeLng]
    ];
}

/**
 * Adds a label to the center of a feature
 */
function addLabel(latlng, text) {
    L.tooltip({
        permanent: true,
        direction: 'center',
        className: 'test-label'
    })
    .setLatLng(latlng)
    .setContent(text)
    .addTo(map);
}

// --- RENDERING SPC OUTLOOKS ---
const outlookBaseLat = 41.5;
const outlookBaseLng = -105;

const outlooks = [
    { label: 'TSTM', name: 'General Thunderstorm' },
    { label: 'MRGL', name: 'Marginal Risk' },
    { label: 'SLGT', name: 'Slight Risk' },
    { label: 'ENH',  name: 'Enhanced Risk' },
    { label: 'MDT',  name: 'Moderate Risk' },
    { label: 'HIGH', name: 'High Risk' }
];

outlooks.forEach((otlk, i) => {
    const lat = outlookBaseLat - (i * 1.5);
    const lng = outlookBaseLng;
    const color = CONFIG.colors[otlk.label];
    
    L.polygon(createBox(lat, lng), {
        fillColor: color,
        weight: 2,
        opacity: 1,
        color: color,
        fillOpacity: 0.35,
        pane: 'outlookPane'
    }).addTo(map);

    addLabel([lat, lng], otlk.label);
});

// --- RENDERING WARNINGS ---
const alertBaseLat = 41.5;
const alertBaseLng = -96;

const alerts = [
    { event: 'Tornado Warning', desc: 'Standard', color: '#ff0000', weight: 2.5, fillOpacity: 0.3 },
    { event: 'Tornado Warning', desc: 'Observed / PDS', color: '#8b0000', weight: 10, fillOpacity: 0.4, pds: true },
    { event: 'Tornado Warning', desc: 'EMERGENCY', color: '#ff00ff', weight: 12, fillOpacity: 0.5, emergency: true },
    { event: 'Severe Thunderstorm Warning', desc: 'Standard', color: '#ffa500', weight: 2.5, fillOpacity: 0.3 },
    { event: 'Severe Thunderstorm Warning', desc: 'Destructive', color: '#cc7a00', weight: 4, fillOpacity: 0.35 }
];

// Add a Confirmed Tornado example
const confirmedTorLat = alertBaseLat - (5 * 1.5);
const confirmedTorLng = alertBaseLng;

L.polygon(createBox(confirmedTorLat, confirmedTorLng), {
    color: '#ff0000',
    weight: 6,
    fillColor: '#ff0000',
    fillOpacity: 0.4,
    className: 'confirmed-tor',
    pane: 'alertPane'
}).addTo(map);
addLabel([confirmedTorLat, confirmedTorLng], 'Confirmed Tornado\n(Pulsing)');

alerts.forEach((alert, i) => {
    const lat = alertBaseLat - (i * 1.5);
    const lng = alertBaseLng;
    
    const poly = L.polygon(createBox(lat, lng), {
        fillColor: alert.color,
        weight: alert.weight,
        opacity: 1,
        color: alert.color,
        fillOpacity: alert.fillOpacity,
        pane: 'alertPane'
    }).addTo(map);

    if (alert.pds || alert.emergency) {
        // Same coordinates as outer border to match real app implementation
        L.polygon(createBox(lat, lng, 0.5, 0.8), {
            color: '#ffffff',
            weight: 2,
            fill: false,
            opacity: 1,
            pane: 'alertPane'
        }).addTo(map);
    }

    addLabel([lat, lng], `${alert.event}\n(${alert.desc})`);
});

// --- RENDERING WATCHES ---
const watchBaseLat = 41.5;
const watchBaseLng = -87;

const watches = [
    { event: 'Tornado Watch', color: '#ffff00' },
    { event: 'Severe Thunderstorm Watch', color: '#db7093' }
];

watches.forEach((watch, i) => {
    const lat = watchBaseLat - (i * 1.5);
    const lng = watchBaseLng;
    
    L.polygon(createBox(lat, lng), {
        fillColor: watch.color,
        weight: 1.5,
        opacity: 0.8,
        color: watch.color,
        fillOpacity: 0.2,
        pane: 'alertPane'
    }).addTo(map);

    addLabel([lat, lng], watch.event);
});

// --- RENDERING PROBABILISTIC OUTLOOKS ---
const probBaseLat = 41.5;
const probBaseLng = -78;

const probColors = {
    '0.02': '#008b00',
    '0.05': '#8b4726',
    '0.10': '#ffff00',
    '0.15': '#ff0000',
    '30%': '#ff00ff',
    '45%': '#912cee',
    '60%': '#104e8b'
};

Object.entries(probColors).forEach(([label, color], i) => {
    const lat = probBaseLat - (i * 1.5);
    const lng = probBaseLng;
    
    L.polygon(createBox(lat, lng), {
        fillColor: color,
        weight: 1.5,
        opacity: 1,
        color: color,
        fillOpacity: 0.35,
        pane: 'outlookPane'
    }).addTo(map);

    addLabel([lat, lng], `Prob: ${label}`);
});

// --- RENDERING RADAR SITES ---
const radarBaseLat = 35.0;
const radarBaseLng = -115;

const sites = [
    { id: 'KOAX', city: 'Omaha', active: false },
    { id: 'KICT', city: 'Wichita', active: true },
    { id: 'KEAX', city: 'Kansas City', active: false }
];

sites.forEach((site, i) => {
    const lat = radarBaseLat - (i * 1.5);
    const lng = radarBaseLng;

    const icon = L.divIcon({
        className: `radar-site-label ${site.active ? 'active-radar' : ''}`,
        html: `<span>${site.id}</span>`,
        iconSize: [40, 20],
        iconAnchor: [20, 10]
    });
    
    L.marker([lat, lng], { icon }).addTo(map);
});

// Center the view on all test elements
map.setView([35, -92], 5);
