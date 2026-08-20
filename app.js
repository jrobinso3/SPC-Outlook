import { initMap } from './src/map.js';
import { log } from './src/logger.js';

// Catch all unhandled runtime errors
window.addEventListener('error', (event) => {
    log.error('FatalError', event.message, `at ${event.filename}:${event.lineno}:${event.colno}`, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    log.error('UnhandledPromise', event.reason);
});

log.boot('Dashboard entry point loaded', { readyState: document.readyState });

if (document.readyState === 'loading') {
    log.boot('Waiting for DOMContentLoaded event...');
    document.addEventListener('DOMContentLoaded', () => {
        log.boot('DOMContentLoaded fired. Initializing map...');
        initMap().catch(err => log.error('Map', 'initMap promise rejected:', err));
    });
} else {
    log.boot('DOM is already ready. Initializing map immediately...');
    initMap().catch(err => log.error('Map', 'initMap promise rejected:', err));
}

