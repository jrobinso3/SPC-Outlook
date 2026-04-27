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
     * Handles road hierarchy, city/town label hierarchy, highway shields,
     * admin boundaries, and environment fills.
     */
    applyPremiumStyles(map) {
        const layers = map.getStyle().layers;

        const c = {
            bg:              '#0b0e14',
            water:           '#060810',
            park:            '#0d1219',
            building:        '#0f1520',

            // Road fills — luminance increases with road class
            motorway:        '#3d4f63',
            trunk:           '#2e3f52',
            primary:         '#243347',
            secondary:       '#1a2638',
            tertiary:        '#141e2c',
            minor:           '#0f1724',
            casing:          '#070b12',

            // Place labels — full hierarchy
            capital:         '#f1f5f9',  // slate-100
            cityLarge:       '#e2e8f0',  // slate-200
            cityMed:         '#cbd5e1',  // slate-300
            town:            '#94a3b8',  // slate-400
            village:         '#64748b',  // slate-500
            hamlet:          '#475569',  // slate-600

            // Road labels / shields
            shieldText:      '#ffffff',
            roadLabel:       '#94a3b8',

            // Admin boundaries
            borderCountry:   '#2d3f52',
            borderState:     '#1a2633',

            // Water labels
            waterText:       '#1a3a5c',

            halo:            '#0b0e14',
        };

        layers.forEach(layer => {
            const id   = layer.id;
            const type = layer.type;
            const lo   = id.toLowerCase();

            try {

                // ── Road lines ──────────────────────────────────────────────
                if (type === 'line' && (lo.includes('road') || lo.includes('bridge') || lo.includes('tunnel') || lo.includes('highway') || lo.includes('transit'))) {
                    const isCasing = lo.includes('casing') || lo.includes('outline') || lo.includes('border');

                    if (lo.includes('motorway') || lo.includes('interstate')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? c.casing : c.motorway);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 4, 0.6, 8, 1.8, 12, 5, 16, 12, 20, 26]);

                    } else if (lo.includes('trunk')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? c.casing : c.trunk);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.5, 9, 1.5, 13, 4, 17, 10]);

                    } else if (lo.includes('primary')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? c.casing : c.primary);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.4, 9, 1.2, 13, 3.5, 17, 9]);

                    } else if (lo.includes('secondary')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? c.casing : c.secondary);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.3, 10, 1, 14, 3, 18, 8]);

                    } else if (lo.includes('tertiary')) {
                        map.setPaintProperty(id, 'line-color', isCasing ? c.casing : c.tertiary);
                        if (!isCasing) map.setPaintProperty(id, 'line-width',
                            ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.2, 12, 1, 16, 3.5]);

                    } else if (!isCasing) {
                        // minor / residential / path
                        map.setPaintProperty(id, 'line-color', c.minor);
                        map.setPaintProperty(id, 'line-opacity', 0.5);
                    } else {
                        map.setPaintProperty(id, 'line-color', c.casing);
                    }
                }

                // ── Admin boundaries ────────────────────────────────────────
                if (type === 'line' && (lo.includes('boundary') || lo.includes('border') || lo.includes('admin'))) {
                    const isNational = lo.includes('country') || lo.includes('national') || lo.includes('2');
                    map.setPaintProperty(id, 'line-color', isNational ? c.borderCountry : c.borderState);
                    map.setPaintProperty(id, 'line-width', isNational ? 1.2 : 0.6);
                    map.setPaintProperty(id, 'line-opacity', isNational ? 0.9 : 0.55);
                    if (!isNational) map.setPaintProperty(id, 'line-dasharray', [5, 5]);
                }

                // ── Symbol layers ───────────────────────────────────────────
                if (type === 'symbol') {

                    // Highway shields & road number labels
                    if (lo.includes('shield') || (lo.includes('road') && lo.includes('label')) || (lo.includes('highway') && lo.includes('label'))) {
                        map.setPaintProperty(id, 'text-color', c.shieldText);
                        map.setPaintProperty(id, 'text-halo-color', 'rgba(0,0,0,0)');
                        map.setPaintProperty(id, 'text-halo-width', 0);
                        map.setLayoutProperty(id, 'text-size',
                            ['interpolate', ['linear'], ['zoom'], 7, 9, 10, 10, 14, 12]);
                        map.setLayoutProperty(id, 'visibility', 'visible');
                        try { map.setPaintProperty(id, 'icon-opacity', 1); } catch(_) {}

                    // Country / continent labels
                    } else if (lo.includes('country') || lo.includes('continent')) {
                        map.setPaintProperty(id, 'text-color', '#2d4060');
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 2);

                    // State / province labels
                    } else if ((lo.includes('state') || lo.includes('province') || lo.includes('region')) && !lo.includes('road') && !lo.includes('highway')) {
                        map.setPaintProperty(id, 'text-color', '#3d5470');
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 2);
                        map.setLayoutProperty(id, 'text-size',
                            ['interpolate', ['linear'], ['zoom'], 4, 10, 7, 13]);
                        try { map.setLayoutProperty(id, 'text-transform', 'uppercase'); } catch(_) {}

                    // Capital cities
                    } else if (lo.includes('capital')) {
                        map.setPaintProperty(id, 'text-color', c.capital);
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 3);
                        map.setLayoutProperty(id, 'text-size',
                            ['interpolate', ['linear'], ['zoom'], 4, 13, 8, 17, 12, 22]);
                        try { map.setLayoutProperty(id, 'text-font', ['Noto Sans Bold']); } catch(_) {}

                    // Large & medium cities
                    } else if (lo.includes('city') || lo.includes('place_label') || lo.includes('place-label')) {
                        map.setPaintProperty(id, 'text-color', c.cityLarge);
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 2.5);
                        map.setLayoutProperty(id, 'text-size',
                            ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 15, 12, 18]);
                        try { map.setLayoutProperty(id, 'text-font', ['Noto Sans Bold']); } catch(_) {}

                    // Towns
                    } else if (lo.includes('town')) {
                        map.setPaintProperty(id, 'text-color', c.town);
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 2);
                        map.setLayoutProperty(id, 'text-size',
                            ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 13, 16, 15]);

                    // Villages, hamlets, suburbs, neighbourhoods
                    } else if (lo.includes('village') || lo.includes('hamlet') || lo.includes('suburb') || lo.includes('neighborhood') || lo.includes('neighbourhood') || lo.includes('quarter')) {
                        map.setPaintProperty(id, 'text-color', c.village);
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 1.5);
                        map.setLayoutProperty(id, 'text-size',
                            ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11]);

                    // Water bodies
                    } else if (lo.includes('water') || lo.includes('ocean') || lo.includes('sea') || lo.includes('lake') || lo.includes('river')) {
                        map.setPaintProperty(id, 'text-color', c.waterText);
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 2);
                        try { map.setLayoutProperty(id, 'text-font', ['Noto Sans Regular']); } catch(_) {}

                    // Generic place / label catch-all
                    } else if (lo.includes('place') || lo.includes('label')) {
                        map.setPaintProperty(id, 'text-color', c.cityMed);
                        map.setPaintProperty(id, 'text-halo-color', c.halo);
                        map.setPaintProperty(id, 'text-halo-width', 2);
                        map.setLayoutProperty(id, 'text-size',
                            ['interpolate', ['linear'], ['zoom'], 5, 11, 10, 14, 14, 16]);
                    }
                }

                // ── Fill layers ─────────────────────────────────────────────
                if (type === 'fill') {
                    if (lo.includes('water') || lo.includes('ocean') || lo.includes('sea') || lo.includes('lake')) {
                        map.setPaintProperty(id, 'fill-color', c.water);

                    } else if (lo.includes('land') || lo.includes('background') || lo.includes('earth')) {
                        map.setPaintProperty(id, 'fill-color', c.bg);
                        try { map.setPaintProperty(id, 'fill-pattern', ''); } catch(_) {}

                    } else if (lo.includes('park') || lo.includes('wood') || lo.includes('forest') || lo.includes('grass') || lo.includes('green') || lo.includes('meadow') || lo.includes('scrub')) {
                        map.setPaintProperty(id, 'fill-color', c.park);
                        map.setPaintProperty(id, 'fill-opacity', 0.9);

                    } else if (lo.includes('building')) {
                        map.setPaintProperty(id, 'fill-color', c.building);
                        map.setPaintProperty(id, 'fill-opacity', 0.65);
                    }
                }

            } catch (_) {
                // Silently skip layers whose properties don't match their type
            }
        });
    }
};
