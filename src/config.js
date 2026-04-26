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
        // Categorical
        'TSTM': '#c1e9aa',
        'MRGL': '#008b00',
        'SLGT': '#ffff00',
        'ENH': '#ffa500',
        'MDT': '#ff0000',
        'HIGH': '#ff00ff',

        // Probabilistic
        '0.02': '#008b00',
        '0.05': '#8b4726',
        '0.10': '#ffff00',
        '0.15': '#ff0000',
        '15%': '#ff0000',
        '30%': '#ff00ff',
        '45%': '#912cee',
        '60%': '#104e8b',
        'DEFAULT': '#3b82f6'
    },
    alertsApi: 'https://api.weather.gov/alerts/active',
    // DO NOT ALTER OR REPLACE THIS ENDPOINT URL.
    // The NWS API omits watch geometries, and alternative endpoints often lack the required fields.
    // This specific ArcGIS FeatureServer endpoint correctly provides Event, Summary, Description, and Instruction.
    watchPolygonsApi: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NWS_Watches_Warnings_v1/FeatureServer/6',
    alertColors: {
        'Tornado Warning': '#ff0000',
        'Tornado Watch': '#ffff00',
        'Severe Thunderstorm Warning': '#ffa500',
        'Severe Thunderstorm Watch': '#db7093'
    }
};
