# LiteSheet

A lightweight, browser-based spreadsheet application built from scratch with TypeScript + Canvas rendering. Inspired by Luckysheet architecture but rewritten as a modern, dependency-light alternative.

## Features

- **Spreadsheet Engine** — Store with undo/redo, multi-select, fill, sort, merge, freeze panes
- **Canvas Rendering** — Fast scrolling, zoom (50%–300%), frozen rows/columns, float images
- **Formula Engine** — JS-based with SUM, AVERAGE, MAX, MIN, COUNT, IF, CONCATENATE, and more
- **Toolbar & Menus** — Full formatting toolbar, context menus, keyboard shortcuts
- **XLSX Import/Export** — Via SheetJS (xlsx full)
- **Filter & Data Validation** — Column filter dialog with value-based selection; list-based data validation
- **Auto-fit Columns** — Double-click column header border to auto-size to content width
- **Drag-reorder Sheets** — Drag sheet tabs to reorder
- **PWA Ready** — Service worker + manifest for offline use

## Quick Start

Open `index.html` in a modern browser (Chrome, Edge, Firefox):

```
LiteSheetWASM/index.html
```

No build step required — the bundled `dist/litesheet.js` and `dist/xlsx.full.min.js` are included.

## Development

```bash
# Install dependencies
npm install

# TypeScript build
npm run build

# IIFE bundle (for browser)
npx esbuild src/index.ts --bundle --outfile=dist/litesheet.js --format=iife --global-name=litesheet

# Tests
npx vitest run

# Type check
npm run typecheck

# Lint
npm run lint

# Automated audit
node audit.cjs
```

## Architecture

```
LiteSheetWASM/
├── index.html           # Main application UI
├── src/
│   ├── core/store/      # Data store (undo/redo, cell ops, sheets)
│   ├── formula/         # Formula engine (JS + WASM backends)
│   ├── rendering/canvas/# Canvas renderer (cells, headers, selection, zoom)
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Helper functions
├── dist/
│   ├── litesheet.js     # IIFE bundle (87KB)
│   └── xlsx.full.min.js # SheetJS for xlsx import/export
├── tests/               # Vitest unit tests
├── public/              # Vite/PWA entry point
└── audit.cjs            # Automated functionality audit
```

## Build Artifacts

The `dist/` folder contains the pre-built runtime:

- `dist/litesheet.js` — The full spreadsheet engine bundled as an IIFE
- `dist/xlsx.full.min.js` — SheetJS for xlsx import/export

## License

MIT
