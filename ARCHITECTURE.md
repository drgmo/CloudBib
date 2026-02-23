# CloudBib — Architecture & Design Document

> A standalone reference manager with group collaboration and Google Drive as the PDF storage layer.

---

## 1. Clarifying Questions & Assumed Defaults

| # | Question | Assumed Default |
|---|----------|-----------------|
| 1 | Maximum group size? | 50 members per group library. No hard technical limit, but UX optimized for ≤50. |
| 2 | Should the backend be self-hosted or SaaS? | Self-hostable Node.js service; can be deployed to any cloud. No vendor lock-in beyond Google Drive for storage. |
| 3 | Citation metadata source — manual entry only or auto-fetch (DOI, ISBN)? | MVP: manual entry + BibTeX/RIS import. Phase 2: DOI/ISBN auto-fetch via CrossRef/OpenLibrary APIs. |
| 4 | PDF size limit? | 200 MB per file (Drive API limit for simple upload is 5 MB; we use resumable upload for all files). |
| 5 | Should annotations be embeddable back into the PDF? | MVP: sidecar JSON only. Phase 2: optional embed-back with explicit conflict warnings. |

---

## 2. MVP Specification

### 2.1 User Stories & Acceptance Criteria

**US-1: Add PDF to Group Library**
> As a group member, I can add a PDF so that all members can access it.

| Criteria | Detail |
|----------|--------|
| AC-1 | User selects a local PDF and a target group library. |
| AC-2 | App computes SHA-256 hash; if duplicate exists, links to existing Drive file. |
| AC-3 | App uploads PDF to the group's Shared Drive folder via resumable upload. |
| AC-4 | App creates an `Attachment` record with `driveFileId`, checksum, size. |
| AC-5 | App creates a stub `Item` (citation) linked to the attachment; user can edit metadata. |
| AC-6 | On upload failure, the operation is queued for retry. |

**US-2: Open & Annotate PDF**
> As a user, I can open a group PDF, highlight text, and add notes.

| Criteria | Detail |
|----------|--------|
| AC-1 | App downloads PDF from Drive to local cache if not already cached (or if remote revision is newer). |
| AC-2 | PDF opens in an embedded PDF.js viewer. |
| AC-3 | User can create highlights (with color), text notes, and rectangular area notes. |
| AC-4 | Annotations auto-save to local SQLite every 30 seconds and on close. |
| AC-5 | On save, annotations are uploaded as a sidecar JSON to Drive. |

**US-3: Sync Metadata**
> As a user, my local library stays in sync with the backend and Drive.

| Criteria | Detail |
|----------|--------|
| AC-1 | On app start and every 5 minutes, the sync loop runs. |
| AC-2 | Local changes (new items, edits) are pushed to the backend. |
| AC-3 | Remote changes are pulled and merged into local SQLite. |
| AC-4 | Conflicts are detected via `modifiedAt` + `version` comparison. |

**US-4: Conflict Resolution**
> As a user, I am warned when my changes conflict with another user's changes.

| Criteria | Detail |
|----------|--------|
| AC-1 | On sync, if remote `version > local baseVersion`, a conflict is flagged. |
| AC-2 | User sees a diff dialog showing local vs. remote changes. |
| AC-3 | User can choose "Keep Mine," "Keep Theirs," or "Merge" (for annotations: union merge). |

**US-5: Export Citations**
> As a user, I can export my library or selected items as BibTeX or CSL-JSON.

| Criteria | Detail |
|----------|--------|
| AC-1 | User selects items and chooses export format. |
| AC-2 | BibTeX output is valid and parseable by LaTeX toolchains. |
| AC-3 | CSL-JSON output conforms to the CSL-JSON schema. |

---

## 3. Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────┐
│                   Electron App                       │
│  ┌──────────────┐  IPC  ┌─────────────────────────┐ │
│  │   Renderer   │◄─────►│     Main Process         │ │
│  │  (React UI)  │       │                           │ │
│  │  - PDF.js    │       │  ┌─────────────────────┐  │ │
│  │  - Library   │       │  │   Service Layer      │  │ │
│  │    Browser   │       │  │  - LibraryService    │  │ │
│  │  - Annotation│       │  │  - DriveService      │  │ │
│  │    Overlay   │       │  │  - AnnotationService │  │ │
│  │  - Citation  │       │  │  - SyncService       │  │ │
│  │    Export    │       │  │  - CacheService      │  │ │
│  └──────────────┘       │  │  - CitationService   │  │ │
│                          │  └──────────┬──────────┘  │ │
│                          │             │              │ │
│                          │  ┌──────────▼──────────┐  │ │
│                          │  │  SQLite (local DB)   │  │ │
│                          │  └─────────────────────┘  │ │
│                          └───────────────────────────┘ │
└──────────────────┬──────────────────┬──────────────────┘
                   │ HTTPS            │ Drive API
                   ▼                  ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  CloudBib API    │  │  Google Drive     │
        │  (Node/Express)  │  │  (Shared Drives)  │
        │  ┌────────────┐  │  │                    │
        │  │ PostgreSQL │  │  │  /GroupA/           │
        │  │  - Groups   │  │  │    paper1.pdf      │
        │  │  - Members  │  │  │    .annotations/   │
        │  │  - Items    │  │  │      paper1.json   │
        │  │  - Versions │  │  │  /GroupB/           │
        │  └────────────┘  │  │    ...              │
        └──────────────────┘  └──────────────────┘
```

### 3.2 Data Flows

**Add PDF to Group:**
```
User selects PDF
  → compute SHA-256
  → check dedup (local DB + backend)
  → if new: resumable upload to Drive → get driveFileId
  → create Attachment record (local + backend)
  → create Item stub (local + backend)
  → sync confirmation
```

**Open PDF for Annotation:**
```
User clicks attachment
  → check local cache (by checksum)
  → if miss or stale: download from Drive → cache
  → open PDF.js viewer with annotation overlay
  → load sidecar JSON (local first, then Drive)
  → render annotations on canvas
```

**Save Annotations:**
```
User edits annotations
  → auto-save to local DB (debounced 30s)
  → on explicit save or close:
    → serialize annotations to JSON
    → upload sidecar JSON to Drive (with etag check)
    → if conflict: prompt user
    → update local + backend version
```

**Sync Loop:**
```
Every 5 min (or manual trigger):
  → pull remote changes from backend (since lastSyncTimestamp)
  → for each changed item:
    → if no local changes: apply remote
    → if local changes exist: compare versions → conflict or merge
  → push local pending changes to backend
  → process upload queue (pending Drive uploads)
  → process annotation queue (pending sidecar uploads)
```

---

## 4. Technology Choices

### 4.1 Desktop Framework: Electron + TypeScript

| Option | Pros | Cons |
|--------|------|------|
| **Electron + TS** ✓ | PDF.js native integration; mature googleapis npm; large ecosystem; fast MVP | Large binary (~100MB); higher memory |
| Tauri + Rust | Small binary; secure; low memory | Rust learning curve; PDF.js in webview is same; slower MVP |
| Flutter | Cross-platform mobile too | Weak PDF annotation libs; immature desktop |

**Decision:** Electron. PDF.js lives in the renderer naturally; Google APIs npm package is battle-tested; development velocity matters for MVP. Binary size is acceptable for a desktop app.

### 4.2 Local Database: SQLite via better-sqlite3

- Synchronous API avoids callback complexity.
- Schema migrations via a simple version table + sequential SQL scripts.
- WAL mode for concurrent read performance.

### 4.3 PDF Rendering & Annotation

- **PDF.js** (Mozilla) for rendering in the Electron renderer process.
- Custom annotation overlay canvas on top of PDF.js pages.
- Annotation model stored as JSON; positions use PDF coordinate system (page number + normalized rect).

### 4.4 Google Drive Integration

- **googleapis** npm package (official).
- OAuth 2.0 with PKCE (desktop flow via loopback redirect).
- Scopes: `drive.file` (access only files created/opened by the app) — least privilege.
- Resumable uploads for all PDFs.
- `fields` parameter on API calls to minimize payload.

### 4.5 Backend: Node.js/Express + PostgreSQL

**Why a backend is needed:**
- Group membership and permissions cannot be reliably managed via Drive alone (no transactional group operations).
- Citation metadata sync needs a central authority for conflict resolution.
- Audit trail requires a trusted server-side log.
- Drive API quotas are per-user; a backend can batch and optimize.

**Minimal endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/login` | Exchange Google OAuth token for session |
| GET | `/groups` | List user's groups |
| POST | `/groups` | Create group |
| POST | `/groups/:id/members` | Add member |
| GET | `/groups/:id/items` | List items (with `?since=` for delta sync) |
| POST | `/groups/:id/items` | Create/update item |
| GET | `/items/:id` | Get item detail |
| PUT | `/items/:id` | Update item (with version check) |
| GET | `/sync/changes` | Get all changes since timestamp |
| POST | `/sync/push` | Push batch of local changes |

---

## 5. Data Model

### 5.1 Local SQLite Schema

```sql
-- Migration tracking
CREATE TABLE _migrations (
  version   INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Libraries (personal or group)
CREATE TABLE libraries (
  id          TEXT PRIMARY KEY,  -- UUID
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('personal','group')),
  groupId     TEXT,              -- NULL for personal
  driveRootId TEXT,              -- Drive folder/Shared Drive ID
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  modifiedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Items (citation metadata)
CREATE TABLE items (
  id          TEXT PRIMARY KEY,
  libraryId   TEXT NOT NULL REFERENCES libraries(id),
  itemType    TEXT NOT NULL DEFAULT 'journalArticle',
  title       TEXT,
  authors     TEXT,              -- JSON array: [{given, family}]
  year        TEXT,
  journal     TEXT,
  volume      TEXT,
  issue       TEXT,
  pages       TEXT,
  doi         TEXT,
  isbn        TEXT,
  abstract    TEXT,
  tags        TEXT,              -- JSON array of strings
  extra       TEXT,              -- JSON object for additional fields
  createdBy   TEXT,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  modifiedAt  TEXT NOT NULL DEFAULT (datetime('now')),
  version     INTEGER NOT NULL DEFAULT 1,
  deleted     INTEGER NOT NULL DEFAULT 0
);

-- Attachments (links to Drive files)
CREATE TABLE attachments (
  id              TEXT PRIMARY KEY,
  itemId          TEXT NOT NULL REFERENCES items(id),
  filename        TEXT NOT NULL,
  mime            TEXT NOT NULL DEFAULT 'application/pdf',
  size            INTEGER,
  checksum        TEXT NOT NULL,          -- SHA-256
  driveFileId     TEXT,
  parentFolderId  TEXT,
  sharedDriveId   TEXT,
  driveWebLink    TEXT,
  driveRevision   TEXT,                   -- Drive revision/etag
  createdBy       TEXT,
  createdAt       TEXT NOT NULL DEFAULT (datetime('now')),
  modifiedAt      TEXT NOT NULL DEFAULT (datetime('now')),
  version         INTEGER NOT NULL DEFAULT 1
);

-- Annotation sets (sidecar JSON metadata)
CREATE TABLE annotation_sets (
  id              TEXT PRIMARY KEY,
  attachmentId    TEXT NOT NULL REFERENCES attachments(id),
  annotations     TEXT NOT NULL DEFAULT '[]',  -- JSON array
  driveFileId     TEXT,                        -- sidecar JSON in Drive
  driveRevision   TEXT,
  localVersion    INTEGER NOT NULL DEFAULT 1,
  remoteVersion   INTEGER NOT NULL DEFAULT 0,
  isDirty         INTEGER NOT NULL DEFAULT 0,
  createdBy       TEXT,
  createdAt       TEXT NOT NULL DEFAULT (datetime('now')),
  modifiedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Upload queue (for offline/retry)
CREATE TABLE upload_queue (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK(type IN ('pdf','annotation','metadata')),
  targetId    TEXT NOT NULL,          -- attachmentId or annotationSetId
  localPath   TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','uploading','failed','completed')),
  retryCount  INTEGER NOT NULL DEFAULT 0,
  maxRetries  INTEGER NOT NULL DEFAULT 5,
  errorMsg    TEXT,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  nextRetryAt TEXT
);

-- Sync state tracking
CREATE TABLE sync_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes
CREATE INDEX idx_items_library ON items(libraryId);
CREATE INDEX idx_items_modified ON items(modifiedAt);
CREATE INDEX idx_attachments_item ON attachments(itemId);
CREATE INDEX idx_attachments_checksum ON attachments(checksum);
CREATE INDEX idx_annotation_sets_attachment ON annotation_sets(attachmentId);
CREATE INDEX idx_upload_queue_status ON upload_queue(status);
```

### 5.2 Backend PostgreSQL Schema (Group Sync)

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  googleId    TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  displayName TEXT,
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  driveId     TEXT,              -- Shared Drive or folder ID
  ownerId     UUID NOT NULL REFERENCES users(id),
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groupId   UUID NOT NULL REFERENCES groups(id),
  userId    UUID NOT NULL REFERENCES users(id),
  role      TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member','viewer')),
  joinedAt  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(groupId, userId)
);

CREATE TABLE items_remote (
  id          UUID PRIMARY KEY,
  groupId     UUID NOT NULL REFERENCES groups(id),
  data        JSONB NOT NULL,     -- Full item metadata
  version     INTEGER NOT NULL DEFAULT 1,
  createdBy   UUID REFERENCES users(id),
  modifiedBy  UUID REFERENCES users(id),
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifiedAt  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted     BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  groupId     UUID REFERENCES groups(id),
  userId      UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  targetType  TEXT,
  targetId    TEXT,
  detail      JSONB,
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 6. Google Drive Design

### 6.1 Shared Drive vs. Shared Folder

| Aspect | Shared Drive | Shared Folder |
|--------|-------------|---------------|
| Ownership | Organization-owned | Creator-owned |
| Member limit | 600 (Google Workspace) | Unlimited sharing |
| Availability | Requires Google Workspace | Any Google account |
| File ownership | Drive owns files | Creator owns files |
| Recommended | ✓ When available | Fallback for personal accounts |

**Decision:** Prefer Shared Drive when the group admin has Google Workspace. Fallback to a shared folder (owned by the group creator) for personal Google accounts. The app detects capability at group creation time.

### 6.2 Permissions Model

- **Shared Drive:** Add each group member as a "Contributor" to the Shared Drive via the Drive API. All files are accessible to all members.
- **Shared Folder:** The creator shares the folder with each member (role: `writer`). The app calls `permissions.create` when a member is added to the group.
- The backend stores the authoritative member list; Drive permissions are kept in sync.

### 6.3 Folder Layout

```
<SharedDrive or SharedFolder>/
  └── CloudBib_<groupId>/
      ├── pdfs/
      │   ├── <sha256_prefix8>_<originalFilename>.pdf
      │   └── ...
      └── annotations/
          ├── <attachmentId>.json
          └── ...
```

- File naming uses `<first 8 chars of SHA-256>_<sanitized original filename>` to balance human readability with uniqueness.
- Annotations are stored in a sibling `annotations/` folder keyed by attachment ID.

### 6.4 Deduplication Strategy

1. Before upload, compute SHA-256 of the local file.
2. Query local DB: `SELECT * FROM attachments WHERE checksum = ?`.
3. If a match exists in the same library, link to the existing `driveFileId` — no re-upload.
4. If a match exists in a different library, still upload (different Drive location) but record the checksum for cross-library dedup hints.
5. The `checksum` index makes lookup O(log n).

### 6.5 Upload Strategy

- **Resumable upload** for all files (even small ones) for consistency.
- Retry with exponential backoff: delays of 1s, 2s, 4s, 8s, 16s (max 5 retries).
- On repeated failure, move to `upload_queue` with `status='failed'` and surface to the user.
- Upload progress is reported via IPC to the renderer for a progress bar.

### 6.6 Stable Open Links

- Store `webViewLink` from the Drive API response on each uploaded file.
- Default behavior: **download to local cache and open in the embedded viewer** (for annotation support).
- Optional "Open in Drive" action uses `webViewLink` in the system browser.

---

## 7. Annotation Sync Strategy

### 7.1 Sidecar JSON Format

```json
{
  "schemaVersion": 1,
  "attachmentId": "uuid",
  "lastModified": "2025-01-15T10:30:00Z",
  "version": 3,
  "createdBy": "user@example.com",
  "annotations": [
    {
      "id": "ann-uuid-1",
      "type": "highlight",
      "page": 1,
      "rects": [
        { "x1": 72.0, "y1": 700.0, "x2": 540.0, "y2": 712.0 }
      ],
      "color": "#FFFF00",
      "text": "selected text content",
      "comment": "User's note about this highlight",
      "createdBy": "user@example.com",
      "createdAt": "2025-01-15T10:30:00Z",
      "modifiedAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": "ann-uuid-2",
      "type": "note",
      "page": 2,
      "position": { "x": 100.0, "y": 500.0 },
      "content": "This section contradicts Smith et al. 2020",
      "createdBy": "other@example.com",
      "createdAt": "2025-01-15T11:00:00Z",
      "modifiedAt": "2025-01-15T11:00:00Z"
    }
  ]
}
```

### 7.2 Storage Location

- Sidecar JSON is stored in `annotations/<attachmentId>.json` within the group's Drive folder.
- This keeps annotations close to the PDFs but in a separate directory for clean organization.

### 7.3 Conflict Resolution

**Scenario:** Alice and Bob both annotate `paper1.pdf` while offline.

1. Alice adds highlight H1 (version 2 → 3 locally).
2. Bob adds note N1 (version 2 → 3 locally).
3. Alice comes online first, uploads version 3. Drive has version 3.
4. Bob comes online, tries to upload his version 3.
5. App detects `driveRevision` mismatch (expected revision from version 2, but Drive has Alice's version 3).
6. App downloads Alice's version 3, performs **union merge**:
   - Annotations with different IDs: include both (H1 + N1).
   - Annotations with same ID but different `modifiedAt`: keep the newer one, flag for review.
   - Annotations with same ID and conflicting content: present side-by-side diff to user.
7. Merged result becomes version 4, uploaded to Drive.

**Union merge is safe** because annotations are independent objects identified by UUID. True conflicts (editing the same annotation) are rare and surfaced to the user.

---

## 8. Offline Mode

### 8.1 Local Cache Layout

```
~/.cloudbib/
  ├── config.json              # App config, OAuth client ID
  ├── cloudbib.db              # SQLite database
  ├── cache/
  │   ├── pdfs/
  │   │   ├── <checksum>.pdf   # Cached PDFs keyed by SHA-256
  │   │   └── ...
  │   └── annotations/
  │       ├── <attachmentId>.json
  │       └── ...
  └── logs/
      └── cloudbib.log
```

### 8.2 Local Queue

When offline, all mutating operations are queued in the `upload_queue` table:

| type | Queued when... |
|------|---------------|
| `pdf` | User adds a PDF but Drive is unreachable |
| `annotation` | User saves annotations but Drive is unreachable |
| `metadata` | User edits item metadata but backend is unreachable |

### 8.3 Reconciliation After Reconnect

1. Detect connectivity (periodic HTTP HEAD to backend health endpoint).
2. Process `upload_queue` in FIFO order.
3. For each queued item:
   - `pdf`: Resumable upload to Drive; on success, update `driveFileId`.
   - `annotation`: Download remote sidecar, merge if needed, upload merged version.
   - `metadata`: Push to backend with version check; handle conflicts.
4. After queue is drained, run a full sync pull.

---

## 9. Conflict Handling

### 9.1 Optimistic Concurrency

- **Version token:** Each `Item` and `AnnotationSet` has an integer `version` field.
- **On save:** Client sends `{ data, expectedVersion }` to the backend.
- **Detection:** Backend checks `currentVersion == expectedVersion`. If not, returns `409 Conflict`.
- **Client UX:**
  1. Fetch the remote version.
  2. Show a conflict dialog with local vs. remote changes.
  3. User picks: "Keep Mine" | "Keep Theirs" | "Merge."
  4. On merge, increment version and save.

### 9.2 Drive File Conflicts

- Drive API returns `etag` / `revision` with each file.
- Before uploading a sidecar JSON, check that the current Drive revision matches the one we last downloaded.
- If mismatch: download remote, merge, upload with new revision.

### 9.3 Optional Lock (Phase 2)

- A lightweight advisory lock: create a `.lock` file in Drive (`<attachmentId>.lock`) with TTL (5 minutes).
- Before editing, check for lock file. If locked by another user, show warning.
- Lock auto-expires (app deletes lock file on save; stale locks older than TTL are ignored).
- This is not required for MVP — union merge handles most cases.

---

## 10. Security

### 10.1 OAuth Token Storage

- Use Electron's `safeStorage` API to encrypt OAuth refresh tokens at rest.
- Tokens are stored in the OS keychain (macOS Keychain, Windows Credential Manager).
- Access tokens are kept in memory only; refreshed as needed.

### 10.2 Least Privilege Scopes

| Scope | Purpose |
|-------|---------|
| `https://www.googleapis.com/auth/drive.file` | Access files created/opened by the app only |
| `https://www.googleapis.com/auth/userinfo.email` | Identify the user |
| `https://www.googleapis.com/auth/userinfo.profile` | Display name |

**Not requested:** `drive` (full Drive access). We only use `drive.file` for principle of least privilege.

### 10.3 Shared Links vs. Authenticated Access

- The app does **not** create shared links. All access is via authenticated Drive API calls.
- This ensures only group members with valid OAuth tokens can access PDFs.
- The `webViewLink` requires the user to be signed in to Google and have permission.

### 10.4 Audit Trail

- The backend `audit_log` table records all mutations: who, what, when, from where.
- Log entries include: `action` (create, update, delete, share), `targetType` (item, attachment, membership), `targetId`, and `detail` (JSON diff).
- Logs are append-only and retained for 1 year by default.

---

## 11. Implementation Plan

### Milestone 1: Local Library + Import PDF (2 weeks)
- [ ] Electron app scaffold (main + renderer)
- [ ] SQLite database setup with migrations
- [ ] Personal library CRUD
- [ ] Import PDF: file picker → compute hash → store metadata
- [ ] Basic library browser UI (list items, show metadata)
- [ ] Manual metadata entry form

### Milestone 2: Google Drive Upload + Group Library (3 weeks)
- [ ] OAuth 2.0 flow (PKCE, loopback redirect)
- [ ] Google Drive service: create folder, resumable upload, download
- [ ] Group library creation (local + backend stub)
- [ ] Add PDF to group: upload to Drive, create attachment record
- [ ] Deduplication check
- [ ] Upload queue with retry

### Milestone 3: PDF Viewer + Annotations (3 weeks)
- [ ] PDF.js integration in renderer
- [ ] Annotation overlay (highlight, text note, area note)
- [ ] Annotation data model (sidecar JSON)
- [ ] Save/load annotations (local)
- [ ] Upload/download sidecar JSON to/from Drive

### Milestone 4: Sync, Offline, Conflicts (2 weeks)
- [ ] Backend API (Node/Express + PostgreSQL)
- [ ] Sync loop: push/pull changes
- [ ] Offline queue processing
- [ ] Conflict detection + resolution UI
- [ ] Annotation union merge

### Milestone 5: Citation Engine (2 weeks)
- [ ] BibTeX export
- [ ] CSL-JSON export
- [ ] RIS import/export
- [ ] Item type mappings (journalArticle, book, conference, etc.)

### Milestone 6: Polish & Platform (2 weeks)
- [ ] macOS + Windows packaging (electron-builder)
- [ ] Auto-update mechanism
- [ ] Error reporting + logging
- [ ] UI polish + keyboard shortcuts

**Total estimated: ~14 weeks for MVP.**

---

## 12. Pseudocode

### 12.1 `addPdfToGroup(groupId, localPdfPath)`

```typescript
async function addPdfToGroup(groupId: string, localPdfPath: string): Promise<Item> {
  // 1. Compute file hash
  const checksum = await computeSHA256(localPdfPath);
  const fileStats = await fs.stat(localPdfPath);
  const filename = path.basename(localPdfPath);

  // 2. Check for duplicates
  const existing = db.prepare(
    'SELECT * FROM attachments WHERE checksum = ? AND itemId IN (SELECT id FROM items WHERE libraryId = ?)'
  ).get(checksum, getLibraryIdForGroup(groupId));

  if (existing) {
    throw new DuplicateError(`PDF already exists in this group library: ${existing.filename}`);
  }

  // 3. Get group's Drive folder
  const group = db.prepare('SELECT * FROM libraries WHERE groupId = ?').get(groupId);
  const pdfsFolderId = await driveService.ensureFolder(group.driveRootId, 'pdfs');

  // 4. Upload to Drive (resumable)
  const driveFile = await driveService.uploadResumable({
    name: `${checksum.slice(0, 8)}_${sanitizeFilename(filename)}`,
    mimeType: 'application/pdf',
    parents: [pdfsFolderId],
    localPath: localPdfPath,
  });

  // 5. Create item + attachment in local DB
  const itemId = uuid();
  const attachmentId = uuid();

  db.transaction(() => {
    db.prepare(`INSERT INTO items (id, libraryId, title, createdBy, itemType)
                VALUES (?, ?, ?, ?, 'journalArticle')`)
      .run(itemId, group.id, filename.replace('.pdf', ''), currentUserId());

    db.prepare(`INSERT INTO attachments (id, itemId, filename, size, checksum,
                driveFileId, parentFolderId, sharedDriveId, driveWebLink, driveRevision, createdBy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(attachmentId, itemId, filename, fileStats.size, checksum,
           driveFile.id, pdfsFolderId, group.driveRootId,
           driveFile.webViewLink, driveFile.headRevisionId, currentUserId());

    db.prepare(`INSERT INTO annotation_sets (id, attachmentId, createdBy)
                VALUES (?, ?, ?)`)
      .run(uuid(), attachmentId, currentUserId());
  })();

  // 6. Cache the PDF locally
  await cacheService.storePdf(checksum, localPdfPath);

  // 7. Queue metadata sync to backend
  await syncService.pushItemToBackend(itemId);

  return getItem(itemId);
}
```

### 12.2 `openPdfForAnnotate(attachmentId)`

```typescript
async function openPdfForAnnotate(attachmentId: string): Promise<ViewerSession> {
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
  if (!attachment) throw new NotFoundError('Attachment not found');

  // 1. Ensure PDF is in local cache
  let localPath = cacheService.getPdfPath(attachment.checksum);

  if (!localPath || !await cacheService.isValid(localPath, attachment.checksum)) {
    // Download from Drive
    localPath = await cacheService.allocatePath(attachment.checksum);
    await driveService.downloadFile(attachment.driveFileId, localPath);
    // Verify checksum
    const downloadedHash = await computeSHA256(localPath);
    if (downloadedHash !== attachment.checksum) {
      throw new IntegrityError('Downloaded file checksum mismatch');
    }
  }

  // 2. Load annotations
  const annotationSet = db.prepare(
    'SELECT * FROM annotation_sets WHERE attachmentId = ?'
  ).get(attachmentId);

  let annotations = JSON.parse(annotationSet.annotations);

  // 3. Check for newer remote annotations
  if (annotationSet.driveFileId) {
    try {
      const remoteMeta = await driveService.getFileMetadata(annotationSet.driveFileId);
      if (remoteMeta.headRevisionId !== annotationSet.driveRevision) {
        const remoteData = await driveService.downloadJSON(annotationSet.driveFileId);
        annotations = mergeAnnotations(annotations, remoteData.annotations);
        db.prepare('UPDATE annotation_sets SET annotations = ?, driveRevision = ?, remoteVersion = ? WHERE id = ?')
          .run(JSON.stringify(annotations), remoteMeta.headRevisionId, remoteData.version, annotationSet.id);
      }
    } catch (err) {
      // Offline — use local annotations
      console.warn('Could not fetch remote annotations, using local:', err.message);
    }
  }

  // 4. Return viewer session
  return {
    pdfPath: localPath,
    annotations,
    annotationSetId: annotationSet.id,
    attachmentId,
  };
}
```

### 12.3 `saveAnnotations(attachmentId, annotations)`

```typescript
async function saveAnnotations(attachmentId: string, annotations: Annotation[]): Promise<void> {
  const annotationSet = db.prepare(
    'SELECT * FROM annotation_sets WHERE attachmentId = ?'
  ).get(attachmentId);

  const newVersion = annotationSet.localVersion + 1;
  const serialized = JSON.stringify(annotations);

  // 1. Save locally
  db.prepare(`UPDATE annotation_sets
              SET annotations = ?, localVersion = ?, isDirty = 1, modifiedAt = datetime('now')
              WHERE id = ?`)
    .run(serialized, newVersion, annotationSet.id);

  // 2. Try to upload to Drive
  try {
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(attachment.itemId);
    const library = db.prepare('SELECT * FROM libraries WHERE id = ?').get(item.libraryId);

    const sidecarData = {
      schemaVersion: 1,
      attachmentId,
      lastModified: new Date().toISOString(),
      version: newVersion,
      createdBy: currentUserId(),
      annotations,
    };

    const annotationsFolderId = await driveService.ensureFolder(library.driveRootId, 'annotations');

    if (annotationSet.driveFileId) {
      // Update existing — check for conflicts
      const remoteMeta = await driveService.getFileMetadata(annotationSet.driveFileId);

      if (remoteMeta.headRevisionId !== annotationSet.driveRevision) {
        // CONFLICT: someone else updated
        const remoteData = await driveService.downloadJSON(annotationSet.driveFileId);
        const merged = mergeAnnotations(annotations, remoteData.annotations);
        sidecarData.annotations = merged;
        sidecarData.version = Math.max(newVersion, remoteData.version) + 1;
        // Notify user of merge
        emitEvent('annotation-merge', { attachmentId, mergedCount: merged.length });
      }

      const updated = await driveService.updateFile(
        annotationSet.driveFileId,
        JSON.stringify(sidecarData, null, 2),
        'application/json'
      );

      db.prepare(`UPDATE annotation_sets
                  SET driveRevision = ?, remoteVersion = ?, isDirty = 0, localVersion = ?
                  WHERE id = ?`)
        .run(updated.headRevisionId, sidecarData.version, sidecarData.version, annotationSet.id);
    } else {
      // Create new sidecar file
      const driveFile = await driveService.createFile({
        name: `${attachmentId}.json`,
        mimeType: 'application/json',
        parents: [annotationsFolderId],
        content: JSON.stringify(sidecarData, null, 2),
      });

      db.prepare(`UPDATE annotation_sets
                  SET driveFileId = ?, driveRevision = ?, remoteVersion = ?, isDirty = 0
                  WHERE id = ?`)
        .run(driveFile.id, driveFile.headRevisionId, newVersion, annotationSet.id);
    }
  } catch (err) {
    // Offline — queue for later
    db.prepare(`INSERT INTO upload_queue (id, type, targetId, status)
                VALUES (?, 'annotation', ?, 'pending')`)
      .run(uuid(), annotationSet.id);
    console.warn('Annotation upload queued for retry:', err.message);
  }
}
```

### 12.4 `syncLoop()`

```typescript
async function syncLoop(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: 0 };

  try {
    // 1. Get last sync timestamp
    const lastSync = db.prepare("SELECT value FROM sync_state WHERE key = 'lastSyncTimestamp'")
      .get()?.value || '1970-01-01T00:00:00Z';

    // 2. Pull remote changes
    const remoteChanges = await backendApi.getChanges(lastSync);

    for (const remote of remoteChanges.items) {
      const local = db.prepare('SELECT * FROM items WHERE id = ?').get(remote.id);

      if (!local) {
        // New remote item — insert locally
        db.prepare(`INSERT INTO items (id, libraryId, itemType, title, authors, year,
                    version, createdAt, modifiedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(remote.id, remote.libraryId, remote.itemType, remote.title,
               JSON.stringify(remote.authors), remote.year, remote.version,
               remote.createdAt, remote.modifiedAt);
        result.pulled++;
      } else if (remote.version > local.version) {
        // Remote is newer
        const localDirty = local.modifiedAt > lastSync;
        if (localDirty) {
          // Conflict!
          emitEvent('sync-conflict', { itemId: remote.id, local, remote });
          result.conflicts++;
        } else {
          // Safe to overwrite local
          db.prepare(`UPDATE items SET title = ?, authors = ?, year = ?,
                      version = ?, modifiedAt = ? WHERE id = ?`)
            .run(remote.title, JSON.stringify(remote.authors), remote.year,
                 remote.version, remote.modifiedAt, remote.id);
          result.pulled++;
        }
      }
    }

    // 3. Push local changes
    const localChanges = db.prepare(
      "SELECT * FROM items WHERE modifiedAt > ? AND version > 0"
    ).all(lastSync);

    for (const item of localChanges) {
      try {
        await backendApi.pushItem(item);
        result.pushed++;
      } catch (err) {
        if (err.status === 409) {
          result.conflicts++;
          emitEvent('sync-conflict', { itemId: item.id, error: err });
        } else {
          result.errors++;
        }
      }
    }

    // 4. Process upload queue
    const pendingUploads = db.prepare(
      "SELECT * FROM upload_queue WHERE status = 'pending' ORDER BY createdAt"
    ).all();

    for (const upload of pendingUploads) {
      try {
        if (upload.type === 'pdf') {
          await processPdfUpload(upload);
        } else if (upload.type === 'annotation') {
          await processAnnotationUpload(upload);
        }
        db.prepare("UPDATE upload_queue SET status = 'completed' WHERE id = ?").run(upload.id);
      } catch (err) {
        const newRetry = upload.retryCount + 1;
        if (newRetry >= upload.maxRetries) {
          db.prepare("UPDATE upload_queue SET status = 'failed', errorMsg = ? WHERE id = ?")
            .run(err.message, upload.id);
        } else {
          const nextRetry = new Date(Date.now() + Math.pow(2, newRetry) * 1000).toISOString();
          db.prepare("UPDATE upload_queue SET retryCount = ?, nextRetryAt = ? WHERE id = ?")
            .run(newRetry, nextRetry, upload.id);
        }
        result.errors++;
      }
    }

    // 5. Update sync timestamp
    db.prepare(`INSERT OR REPLACE INTO sync_state (key, value, updatedAt)
                VALUES ('lastSyncTimestamp', ?, datetime('now'))`)
      .run(new Date().toISOString());

  } catch (err) {
    console.error('Sync loop error:', err);
    result.errors++;
  }

  return result;
}
```

---

## 13. CSL-Based Citation Engine Plan

### Phase 1 (MVP): Export

**BibTeX Export:**
- Map internal `itemType` to BibTeX entry types (`article`, `book`, `inproceedings`, etc.).
- Generate valid BibTeX with proper escaping of special characters.
- Cite keys generated as `AuthorYear` (e.g., `Smith2024`), with suffix for disambiguation (`Smith2024a`).

**CSL-JSON Export:**
- Map internal model directly to CSL-JSON schema.
- CSL-JSON is the native format of Zotero and many citation tools.
- Validate output against the official CSL-JSON schema.

**RIS Import/Export:**
- Support RIS format for compatibility with other reference managers.

### Phase 2: Citation Workflow

- **CSL Processor:** Integrate `citeproc-js` for formatting citations according to 10,000+ CSL styles.
- **Word Plugin:** Use Office.js add-in API for inserting in-text citations and generating bibliographies.
- **LibreOffice Plugin:** Use UNO API bridge for the same workflow in LibreOffice.
- **Clipboard Integration:** "Copy Citation" generates formatted text (APA, MLA, Chicago, etc.) for pasting.

---

## Appendix A: Key Dependencies

| Package | Purpose | License |
|---------|---------|---------|
| `electron` | Desktop framework | MIT |
| `better-sqlite3` | SQLite bindings | MIT |
| `googleapis` | Google Drive API | Apache-2.0 |
| `pdfjs-dist` | PDF rendering | Apache-2.0 |
| `uuid` | UUID generation | MIT |
| `electron-store` | Config persistence | MIT |

## Appendix B: Environment Variables

```
GOOGLE_CLIENT_ID=     # OAuth client ID (bundled in app)
GOOGLE_CLIENT_SECRET= # OAuth client secret (if using installed app flow)
CLOUDBIB_API_URL=     # Backend API URL (default: https://api.cloudbib.io)
CLOUDBIB_DATA_DIR=    # Override data directory (default: ~/.cloudbib)
```
