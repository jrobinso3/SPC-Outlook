# Severe Weather Outlook Dashboard

A professional-grade, high-fidelity severe weather monitoring dashboard that integrates live NOAA/SPC data with real-time radar imagery.

![Dashboard Preview](https://raw.githubusercontent.com/jrobinso3/SPC-Outlook/main/preview.png)

## Why This Dashboard?

While apps like RadarScope provide excellent raw radar data, they often lack the long-term context of the Storm Prediction Center (SPC) outlooks. Conversely, web-based SPC maps are often static and difficult to use for real-time tracking.

**This dashboard bridge that gap.** It is designed for storm chasers, emergency managers, and weather enthusiasts who need a "God-view" of current and future threats in a single, fluid interface.

### Key Advantages Over Traditional Apps:

*   **Deep SPC Integration**: Unlike RadarScope, which focuses primarily on the current moment, this dashboard integrates the full 5-day SPC Outlook cycle. See the Categorical, Tornado, Wind, and Hail probabilities rendered with high-fidelity SVG hatching and transparency.
*   **Intelligent Radar Steering**: Stop manually hunting for station IDs. As you pan the map, the dashboard automatically identifies and connects to the nearest NWS radar site, ensuring you always have the best view of the local storm structure.
*   **Superior Alert Hierarchy**: Most apps clutter the screen with overlapping alerts. This dashboard uses a strict, logical layering system:
    1.  **Outlooks** (The baseline threat)
    2.  **Watches** (The broad warning area)
    3.  **Radar** (The current activity)
    4.  **Warnings** (The immediate danger)
    5.  **Labels** (Street-level context)
*   **PDS & Emergency Priority**: In life-threatening situations, every second counts. The dashboard automatically identifies **Particularly Dangerous Situation (PDS)** and **Tornado Emergency** warnings, applying distinctive high-contrast styling and pulsing effects that cut through the noise.
*   **Technical Discussion Integration**: Access the official NWS/SPC technical discussions directly from the map polygons. Read the "why" behind the forecast without leaving the map.
*   **Modern "Glassmorphism" UI**: Built with a sleek, dark-mode aesthetic that prioritizes visual clarity and minimizes eye strain during long-duration severe weather events.

## Features

- **Live Radar**: Switch between Reflectivity and Velocity with animated loops.
- **Dynamic Legends**: Context-aware legends that show exactly what’s on the map.
- **Hatching (SIG)**: Specialized patterns for "Significant" severe threats (EF2+ tornadoes, 2"+ hail, 75mph+ winds).
- **Find My Location**: High-precision GPS tracking with an intuitive navigation interface.
- **Responsive Design**: Optimized for both high-resolution desktop monitors and mobile field use.

## Documentation

For technical details and setup instructions, please refer to the following documents:

- [**Technical Architecture**](./docs/architecture.md): Deep dive into the modular design, data providers, and theme system.
- [**Development Guide**](./docs/development.md): Instructions for local setup, building for production, and contribution guidelines.

---
*Data provided by NOAA, NWS, and the Storm Prediction Center.*
