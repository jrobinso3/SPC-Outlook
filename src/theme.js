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
    },

    /**
     * Applies comprehensive dark-theme styling to all basemap vector layers.
     * Uses centralized CONFIG.theme for all tokens.
     */
    applyPremiumStyles(map) {
        const layers = map.getStyle().layers;
        const t = CONFIG.theme;

        layers.forEach(layer => {
            const id   = layer.id;
            const type = layer.type;
            const lo   = id.toLowerCase();

            try {
                // ── Road lines ──────────────────────────────────────────────
                if (type === 'line' && (lo.includes('road') || lo.includes('bridge') || lo.includes('tunnel') || lo.includes('highway') || lo.includes('transit'))) {
                    const isCasing = lo.includes('casing') || lo.includes('outline') || lo.includes('border');

                    if (lo.includes('motorway') || lo.includes('interstate')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? t.roads.casing : t.roads.motorway);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 4, 0.6, 8, 1.8, 12, 5, 16, 12, 20, 26]);

                    } else if (lo.includes('trunk')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? t.roads.casing : t.roads.trunk);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.5, 9, 1.5, 13, 4, 17, 10]);

                    } else if (lo.includes('primary')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? t.roads.casing : t.roads.primary);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.4, 9, 1.2, 13, 3.5, 17, 9]);

                    } else if (lo.includes('secondary')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? t.roads.casing : t.roads.secondary);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.3, 10, 1, 14, 3, 18, 8]);

                    } else if (lo.includes('tertiary')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? t.roads.casing : t.roads.tertiary);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.2, 12, 1, 16, 3.5]);

                    } else if (!isCasing) {
                        map.setPaintProperty(id, 'line-color', t.roads.minor);
                        map.setPaintProperty(id, 'line-opacity', 0.5);
                    } else {
                        map.setPaintProperty(id, 'line-color', t.roads.casing);
                    }
                }

                // ── Symbol layers (Labels) ──────────────────────────────────
                if (type === 'symbol') {
                    // Set default font for all labels
                    try { map.setLayoutProperty(id, 'text-font', [t.fonts.main]); } catch(_) {}

                    // Highway shields
                    if (lo.includes('shield') || (lo.includes('road') && lo.includes('label')) || (lo.includes('highway') && lo.includes('label'))) {
                        map.setPaintProperty(id, 'text-color', '#ffffff');
                        map.setPaintProperty(id, 'text-halo-color', 'rgba(0,0,0,0)');
                        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 7, 14, 10, 15, 14, 18]);
                        try { map.setLayoutProperty(id, 'text-font', [t.fonts.main]); } catch(_) {}

                    } else if (lo.includes('country') || lo.includes('continent')) {
                        map.setPaintProperty(id, 'text-color', t.labels.country.color);
                        map.setPaintProperty(id, 'text-halo-color', t.labels.country.halo);
                        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 2, t.labels.country.size, 6, t.labels.country.size * 1.5]);

                    } else if (lo.includes('state') || lo.includes('province') || lo.includes('region')) {
                        map.setPaintProperty(id, 'text-color', t.labels.state.color);
                        map.setPaintProperty(id, 'text-halo-color', t.labels.state.halo);
                        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 4, t.labels.state.size, 7, t.labels.state.size * 1.3]);

                    } else if (lo.includes('capital')) {
                        map.setPaintProperty(id, 'text-color', t.labels.capital.color);
                        map.setPaintProperty(id, 'text-halo-color', t.labels.capital.halo);
                        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 4, t.labels.capital.size, 12, t.labels.capital.size * 1.5]);
                        try { map.setLayoutProperty(id, 'text-font', [t.fonts.bold]); } catch(_) {}

                    } else if (lo.includes('city') || lo.includes('place_label') || lo.includes('place-label')) {
                        map.setPaintProperty(id, 'text-color', t.labels.city.color);
                        map.setPaintProperty(id, 'text-halo-color', t.labels.city.halo);
                        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 4, t.labels.city.size, 12, t.labels.city.size * 1.5]);
                        try { map.setLayoutProperty(id, 'text-font', [t.fonts.bold]); } catch(_) {}

                    } else if (lo.includes('town')) {
                        map.setPaintProperty(id, 'text-color', t.labels.town.color);
                        map.setPaintProperty(id, 'text-halo-color', t.labels.town.halo);
                        map.setLayoutProperty(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 8, t.labels.town.size, 16, t.labels.town.size * 1.4]);

                    } else if (lo.includes('water') || lo.includes('ocean') || lo.includes('lake') || lo.includes('river')) {
                        map.setPaintProperty(id, 'text-color', t.labels.water.color);
                        map.setLayoutProperty(id, 'text-size', t.labels.water.size);
                    }
                }

                // ── Fill layers ─────────────────────────────────────────────
                if (type === 'fill') {
                    if (lo.includes('water') || lo.includes('ocean') || lo.includes('sea') || lo.includes('lake')) {
                        map.setPaintProperty(id, 'fill-color', '#060810');
                    } else if (lo.includes('land') || lo.includes('background') || lo.includes('earth')) {
                        map.setPaintProperty(id, 'fill-color', t.background);
                    } else if (lo.includes('park') || lo.includes('wood') || lo.includes('forest')) {
                        map.setPaintProperty(id, 'fill-color', '#0d1219');
                    } else if (lo.includes('building')) {
                        map.setPaintProperty(id, 'fill-color', '#0f1520');
                    }
                }

                // ── Circle layers (City Points) ──────────────────────────────
                if (type === 'circle' && (lo.includes('city') || lo.includes('place') || lo.includes('town'))) {
                    if (!t.visibility.cityPoints) {
                        map.setLayoutProperty(id, 'visibility', 'none');
                    }
                }

            } catch (_) {}
        });
    }
};
