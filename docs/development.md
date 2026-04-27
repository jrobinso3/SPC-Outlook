# Development Guide

This document outlines how to set up the development environment and contribute to the Severe Weather Outlook Dashboard.

## Prerequisites

- **Node.js**: LTS version (v18+) recommended.
- **npm**: v9+ recommended.

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jrobinso3/SPC-Outlook.git
   cd SPC-Outlook
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:5173`.

## Build & Deployment

### Production Build
To create an optimized production bundle:
```bash
npm run build
```
The output will be located in the `dist/` directory.

### Preview Build
To test the production build locally:
```bash
npm run preview
```

## Project Structure

- `src/`: All JavaScript source code.
- `public/`: Static assets (icons, images).
- `index.html`: The main entry point and UI shell.
- `docs/`: Technical and architectural documentation.

## Contributing

1. Fork the project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.
