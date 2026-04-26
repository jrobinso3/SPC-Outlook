export const CONFIG = {
    mapCenter: [39.8283, -98.5795], // Geograhic center of CONUS
    initialZoom: 4,
    apiBase: 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer',
    layers: [
        { id: 1, name: 'Day 1 Categorical', key: 'day1cat', discussion: 'day1' },
        { id: 3, name: 'Day 1 Tornado', key: 'day1torn', discussion: 'day1' },
        { id: 5, name: 'Day 1 Hail', key: 'day1hail', discussion: 'day1' },
        { id: 7, name: 'Day 1 Wind', key: 'day1wind', discussion: 'day1' },
        { id: 9, name: 'Day 2 Categorical', key: 'day2cat', discussion: 'day2' },
        { id: 17, name: 'Day 3 Categorical', key: 'day3cat', discussion: 'day3' },
        { id: 21, name: 'Day 4 Probabilistic', key: 'day4prob', discussion: 'day48' },
        { id: 22, name: 'Day 5 Probabilistic', key: 'day5prob', discussion: 'day48' }
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
        
        // Probabilistic (Tornado, Wind, Hail, Day 4-8)
        '0.02': '#008b00',
        '0.05': '#8b4726',
        '0.10': '#ffff00',
        '0.15': '#ff0000',
        '30%': '#ff00ff',
        '45%': '#912cee',
        '60%': '#104e8b',
        '15%': '#ff0000',
        // '30%': '#ff00ff', // Duplicate key
        'DEFAULT': '#3b82f6'
    },
    alertsApi: 'https://api.weather.gov/alerts/active',
    watchPolygonsApi: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NWS_Watches_Warnings_v1/FeatureServer/6',
    alertColors: {
        'Tornado Warning': '#ff0000',
        'Tornado Watch': '#ffff00',
        'Severe Thunderstorm Warning': '#ffa500',
        'Severe Thunderstorm Watch': '#db7093'
    }
};
