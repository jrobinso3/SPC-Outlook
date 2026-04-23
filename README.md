# US Severe Weather Outlook Dashboard

A real-time, high-fidelity severe weather monitoring dashboard that visualizes data from the NOAA Storm Prediction Center (SPC).

![Dashboard Preview](screenshot_placeholder.png)

## Features
- **Real-time Map**: Visualizes Day 1-5 convective outlooks, including Tornado, Wind, and Hail probability layers.
- **Human-Readable Dates**: Converts SPC raw timestamps to your local timezone automatically.
- **Technical Discussions**: Fetch and read the latest meteorological technical discussions directly within the interface.
- **Glassmorphism UI**: A modern, dark-themed interface built with Tailwind CSS v4 and Leaflet.js.
- **Fully Responsive**: Optimized for both desktop monitors and smartphone devices.

## Tech Stack
- **Framework**: Semantic HTML5 & Vanilla JavaScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Mapping**: [Leaflet.js](https://leafletjs.com/) with CartoDB Dark Matter tiles.
- **Data Source**: NOAA SPC ArcGIS MapServer API.

## Local Development
Since this project uses modern browser features and fetches data from external APIs, it is recommended to run it through a local web server (like Live Server or `npx serve`).

1. Clone the repository:
   ```bash
   git clone https://github.com/jrobinso3/Weather-Site.git
   ```
2. Open `index.html` in your browser via a local server.

## License
MIT
