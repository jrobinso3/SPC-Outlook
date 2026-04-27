import { CONFIG } from './config.js';

/**
 * ThemeManager handles all visual styling lookups (colors, patterns, categories)
 */
export const ThemeManager = {
    /**
     * Gets the appropriate color set for a layer type
     */
    getColorSet(layerKey) {
        if (layerKey.includes('torn')) return CONFIG.colors.tornado;
        if (layerKey.includes('hail')) return CONFIG.colors.hail;
        if (layerKey.includes('wind')) return CONFIG.colors.wind;
        if (layerKey.includes('day4') || layerKey.includes('day5')) return CONFIG.colors.extended;
        if (layerKey.includes('prob')) return CONFIG.colors.wind;
        return CONFIG.colors.categorical;
    },

    /**
     * Gets the color for a specific label and layer type
     */
    getColor(layerKey, label) {
        const colorSet = this.getColorSet(layerKey);
        return colorSet[label] || CONFIG.colors.DEFAULT;
    },

    /**
     * Gets the categories for a specific layer type (for legends)
     */
    getCategories(layerKey) {
        if (layerKey.includes('cat')) {
            return ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT', 'HIGH'];
        }
        if (layerKey.includes('torn')) {
            return ['2%', '5%', '10%', '15%', '30%', '45%', '60%'];
        }
        if (layerKey.includes('day4') || layerKey.includes('day5')) {
            return ['15%', '30%'];
        }
        return ['5%', '15%', '30%', '45%', '60%', '75%', '90%'];
    },

    /**
     * Gets the style for NWS Warnings and Watches
     */
    getAlertStyle(feature) {
        const p = feature.properties;
        const event = p.event || '';
        const headline = (p.headline || '').toUpperCase();
        const desc = (p.description || '').toUpperCase();
        
        let color = '#3b82f6'; 
        let weight = 2;
        let fillOpacity = 0.3;
        let className = '';

        if (event.includes('Tornado Warning')) {
            const isEmergency = desc.includes('TORNADO EMERGENCY') || headline.includes('EMERGENCY');
            const isObserved = desc.includes('TORNADO...OBSERVED') || desc.includes('OBSERVED TORNADO');
            const isPDS = desc.includes('PARTICULARLY DANGEROUS SITUATION') || 
                          headline.includes('PARTICULARLY DANGEROUS SITUATION') || 
                          (p.instruction || '').toUpperCase().includes('PARTICULARLY DANGEROUS SITUATION') ||
                          headline.includes('PDS') || desc.includes('PDS');

            if (isEmergency) {
                color = '#ff00ff'; weight = 12; fillOpacity = 0.5;
            } else if (isObserved || isPDS) {
                color = '#8b0000'; weight = 10; fillOpacity = 0.4;
            } else {
                color = '#ff0000'; weight = 2.5; fillOpacity = 0.3;
            }
            if (isObserved) className = 'confirmed-tor';
        } else if (event.includes('Tornado Watch')) {
            color = '#ffff00'; weight = 1; fillOpacity = 0.25;
        } else if (event.includes('Severe Thunderstorm Warning')) {
            const isDestructive = desc.includes('DESTRUCTIVE') || desc.includes('80 MPH');
            color = isDestructive ? '#cc7a00' : '#ffa500';
            weight = isDestructive ? 4 : 2.5;
        } else if (event.includes('Severe Thunderstorm Watch')) {
            color = '#db7093'; weight = 1; fillOpacity = 0.25;
        }
        
        return {
            fillColor: color,
            weight: weight,
            opacity: 1,
            color: color,
            fillOpacity: fillOpacity,
            className: className
        };
    },

    /**
     * Gets the SVG pattern for SIG (intensity) layers
     */
    getSigPattern(label) {
        const patternMap = {
            'CIG1': 'url(#pattern-cig1)',
            'CIG2': 'url(#pattern-cig2)',
            'CIG3': 'url(#pattern-cig3)'
        };
        return patternMap[label.toUpperCase()] || 'transparent';
    }
};
