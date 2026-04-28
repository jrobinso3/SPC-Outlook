export const CONFIG = {
    mapCenter: [39.8283, -98.5795], // Geographic center of CONUS
    initialZoom: 4,
    apiBase: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer',
    layers: [
        { id: 1, name: "Today's Categorical Outlook", key: 'day1cat', discussion: 'day1' },
        { id: 3, name: "Today's Tornado Probabilities", key: 'day1torn', discussion: 'day1', sigLayerId: 2 },
        { id: 5, name: "Today's Hail Probabilities", key: 'day1hail', discussion: 'day1', sigLayerId: 4 },
        { id: 7, name: "Today's Wind Probabilities", key: 'day1wind', discussion: 'day1', sigLayerId: 6 },

        { id: 9, name: 'Day 2 Categorical Outlook', key: 'day2cat', discussion: 'day2' },
        { id: 11, name: 'Day 2 Tornado Probabilities', key: 'day2torn', discussion: 'day2', sigLayerId: 10 },
        { id: 13, name: 'Day 2 Hail Probabilities', key: 'day2hail', discussion: 'day2', sigLayerId: 12 },
        { id: 15, name: 'Day 2 Wind Probabilities', key: 'day2wind', discussion: 'day2', sigLayerId: 14 },

        { id: 17, name: 'Day 3 Categorical Outlook', key: 'day3cat', discussion: 'day3' },
        { id: 19, name: 'Day 3 Total Severe Probabilities', key: 'day3prob', discussion: 'day3', sigLayerId: 18 },

        { id: 21, name: 'Day 4 Total Severe Probabilities', key: 'day4prob', discussion: 'day48' },
        { id: 22, name: 'Day 5 Total Severe Probabilities', key: 'day5prob', discussion: 'day48' }
    ],
    discussionBase: 'https://www.spc.noaa.gov/products/outlook',
    colors: {
        categorical: {
            'TSTM': '#c1e9aa',
            'MRGL': '#008b00',
            'SLGT': '#ffff00',
            'ENH': '#ffa500',
            'MDT': '#ff0000',
            'HIGH': '#ff00ff'
        },
        tornado: {
            '0.02': '#008b00', '2%': '#008b00',
            '0.05': '#8b4726', '5%': '#8b4726',
            '0.10': '#ffa500', '10%': '#ffa500',
            '0.15': '#ff0000', '15%': '#ff0000',
            '0.30': '#ff00ff', '30%': '#ff00ff',
            '0.45': '#912cee', '45%': '#912cee',
            '0.60': '#104e8b', '60%': '#104e8b'
        },
        hail: {
            '0.05': '#8b4726', '5%': '#8b4726',
            '0.15': '#ffa500', '15%': '#ffa500',
            '0.30': '#ff0000', '30%': '#ff0000',
            '0.45': '#ff00ff', '45%': '#ff00ff',
            '0.60': '#912cee', '60%': '#912cee'
        },
        wind: {
            '0.05': '#8b4726', '5%': '#8b4726',
            '0.15': '#ffff00', '15%': '#ffff00',
            '0.30': '#ff0000', '30%': '#ff0000',
            '0.45': '#ff00ff', '45%': '#ff00ff',
            '0.60': '#912cee', '60%': '#912cee',
            '0.75': '#3b82f6', '75%': '#3b82f6',
            '0.90': '#00ffff', '90%': '#00ffff'
        },
        extended: {
            '0.15': '#ffff99', '15%': '#ffff99',
            '0.30': '#e6c28c', '30%': '#e6c28c'
        },
        'DEFAULT': '#3b82f6'
    },
    alertsApi: 'https://api.weather.gov/alerts/active',
    watchPolygonsApi: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NWS_Watches_Warnings_v1/FeatureServer/6',
    sigDescriptions: {
        TORNADO: {
            'CIG1': 'EF2 - EF3 Tornadoes Possible',
            'CIG2': 'EF4 Tornadoes Possible',
            'CIG3': 'EF5 Tornadoes Possible'
        },
        WIND: {
            'CIG1': '75 - 84 MPH Wind Gusts',
            'CIG2': '85 - 99 MPH Wind Gusts (Destructive)',
            'CIG3': '100+ MPH Wind Gusts (Extreme)'
        },
        HAIL: {
            'CIG1': '2.0" - 2.9" Hail (Egg to Baseball)',
            'CIG2': '3.0" - 3.9" Hail (Tea Cup to Softball)',
            'CIG3': '4.0"+ Hail (Grapefruit size+)'
        }
    },

    // ── Map Styling & Theme Engine ──────────────────────────────────────────
    theme: {
        background: '#0b0e14',
        fonts: {
            main: 'Noto Sans Regular',
            bold: 'Noto Sans Bold',
            ui:   'Outfit'
        },
        roads: {
            motorway:  '#3d4f63',
            trunk:     '#2e3f52',
            primary:   '#243347',
            secondary: '#1a2638',
            tertiary:  '#141e2c',
            minor:     '#0f1724',
            casing:    '#070b12'
        },
        labels: {
            capital: { color: '#f1f5f9', size: 14, halo: '#0b0e14' },
            city:    { color: '#e2e8f0', size: 12, halo: '#0b0e14' },
            town:    { color: '#94a3b8', size: 11, halo: '#0b0e14' },
            village: { color: '#64748b', size: 10, halo: '#0b0e14' },
            state:   { color: '#3d5470', size: 12, halo: '#0b0e14' },
            country: { color: '#2d4060', size: 14, halo: '#0b0e14' },
            water:   { color: '#1a3a5c', size: 10, halo: '#0b0e14' }
        },
        visibility: {
            cityPoints: false,
            buildings: true,
            terrain: true
        }
    }
};
