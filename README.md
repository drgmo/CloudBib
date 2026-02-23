# CloudBib

A standalone reference manager with group collaboration and Google Drive as the PDF storage layer.

## Overview

CloudBib is a Zotero-like reference manager whose key differentiator is group collaboration with Google Drive providing the PDF storage layer — no vendor storage quotas. Group members can add PDFs, annotate them, and sync metadata, all backed by Google Drive.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design document.

## Features (MVP)

- **Personal & group libraries** for organizing citations
- **Google Drive integration** for PDF storage (Shared Drives or shared folders)
- **PDF viewer with annotations** (highlights, notes, area notes) stored as sidecar JSON
- **Annotation conflict resolution** via union merge
- **Citation export** in BibTeX, CSL-JSON, and RIS formats
- **Offline support** with local cache and upload queue
- **Optimistic concurrency** with conflict detection and resolution
- **Electron desktop app** with React-based three-panel UI

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Desktop framework:** Electron
- **UI:** React + TypeScript (renderer process)
- **Local database:** SQLite via `better-sqlite3`
- **PDF rendering:** PDF.js
- **Google Drive:** `googleapis` npm package
- **Backend:** Node.js/Express + PostgreSQL (for group sync)

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Running the Desktop App

```bash
npm start
```

This compiles all TypeScript (core, electron, renderer) and launches the Electron app.

### Running Tests

```bash
npm test
```

### Building for Distribution

```bash
npm run electron-build
```

This builds installers for the current platform. Output is placed in the `release/` directory.

Supported targets:
- **macOS:** `.dmg`
- **Windows:** NSIS installer
- **Linux:** AppImage

## Project Structure

```
src/                        # Core library (business logic, DB, services)
├── db/
│   ├── connection.ts       # SQLite connection + migration runner
│   └── schema.ts           # Versioned schema migrations
├── models/
│   └── types.ts            # All domain type definitions
├── services/
│   ├── annotation.service.ts  # Annotation merge + sidecar serialization
│   ├── cache.service.ts       # Local PDF/annotation cache
│   ├── citation.service.ts    # BibTeX, CSL-JSON, RIS export
│   ├── drive.service.ts       # Google Drive interface + utilities
│   ├── library.service.ts     # Core library/item/attachment operations
│   └── sync.service.ts        # Sync loop + upload queue processing
└── index.ts                # Public API re-exports

electron/                   # Electron main process
├── main.ts                 # App entry point, window management
├── preload.ts              # contextBridge API for renderer
└── ipc-handlers.ts         # IPC bridge to core services

renderer/                   # React renderer (UI)
├── index.html              # HTML entry point
├── index.tsx               # React mount point
├── App.tsx                 # Root component (three-panel layout)
├── types.ts                # Renderer type declarations
└── components/
    ├── LibraryPanel.tsx     # Left: library tree / collections
    ├── ItemsPanel.tsx       # Center: items list (papers)
    ├── DetailsPanel.tsx     # Right: item details (metadata, citations)
    └── PdfViewer.tsx        # PDF.js viewer with annotation overlay

tests/
├── annotation.test.ts
├── cache.test.ts
├── citation.test.ts
├── drive.test.ts
└── library.test.ts
```

## Architecture

The app follows a strict separation between core logic and UI:

- **Core services** (`src/`) handle all business logic, database operations, and Google Drive interactions
- **Electron main process** (`electron/`) initializes the app, manages windows, and bridges IPC calls to core services
- **React renderer** (`renderer/`) provides the UI; communicates with the main process exclusively through typed IPC channels
- No direct DB or Google Drive calls from React components

## Google Drive Onboarding

To enable Google Drive sync, set the following environment variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI (default: `http://localhost`) |

Create a `.env` file in the project root or set these in your shell environment.
For detailed setup instructions, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Build Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Build all and launch Electron app |
| `npm test` | Run tests with coverage |
| `npm run build` | Compile core TypeScript |
| `npm run build:electron` | Compile Electron main process |
| `npm run build:renderer` | Compile renderer React code |
| `npm run build:all` | Compile everything |
| `npm run electron-build` | Package for distribution |

## License

MIT
