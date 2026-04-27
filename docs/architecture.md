# Technical Architecture

The SPC Outlook Dashboard is built on a modular, provider-based architecture designed for high performance and low-latency weather data visualization.

## Core Modules

### 1. `ThemeManager` (`src/theme.js`)
The centralized visual engine of the application. It decouples the map logic from the styling rules.
- **Single Source of Truth**: All colors, hatching patterns, and category labels are defined here.
- **Context-Aware Styling**: Automatically adjusts styles based on layer type (Tornado vs. Hail) and threat intensity.

### 2. `DataProvider` (`src/api.js`)
The data orchestration layer that manages all external communications.
- **Edge Normalization**: Converts raw API outputs (e.g., probability decimals) into standardized display labels immediately upon fetch.
- **Geometry Dissolving**: Uses `turf.js` to merge fragmented county-level watch data into unified polygons for cleaner map rendering.

### 3. `RadarEngine` (`src/radar.js` & `src/radar-animation.js`)
Handles the complex lifecycle of NWS radar tiles.
- **Auto-Steering**: Intelligently calculates distances to nearby radar sites and switches stations as the user pans the map.
- **Double-Buffering**: Pre-loads the next frame in an animation loop to prevent flickering.

### 4. `State Manager` (`src/state.js`)
A centralized state object that tracks map position, active layers, radar products, and UI visibility. This state is persisted to `localStorage` to preserve user preferences across sessions.

## Technology Stack

- **Leaflet.js**: Primary mapping engine.
- **Turf.js**: Advanced geospatial processing.
- **Vite**: Modern build tool and development server.
- **Vanilla CSS / Tailwind**: Used for the high-performance glassmorphism UI.
