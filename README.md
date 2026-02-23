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

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Desktop framework:** Electron (planned)
- **Local database:** SQLite via `better-sqlite3`
- **PDF rendering:** PDF.js (planned)
- **Google Drive:** `googleapis` npm package
- **Backend:** Node.js/Express + PostgreSQL (for group sync)

## Getting Started

```bash
npm install
npm run build
npm test
```

## Project Structure

```
src/
├── db/
│   ├── connection.ts    # SQLite connection + migration runner
│   └── schema.ts        # Versioned schema migrations
├── models/
│   └── types.ts         # All domain type definitions
├── services/
│   ├── annotation.service.ts  # Annotation merge + sidecar serialization
│   ├── cache.service.ts       # Local PDF/annotation cache
│   ├── citation.service.ts    # BibTeX, CSL-JSON, RIS export
│   ├── drive.service.ts       # Google Drive interface + utilities
│   ├── library.service.ts     # Core library/item/attachment operations
│   └── sync.service.ts        # Sync loop + upload queue processing
└── index.ts             # Public API re-exports

tests/
├── annotation.test.ts
├── cache.test.ts
├── citation.test.ts
├── drive.test.ts
└── library.test.ts
```

## License

MIT
