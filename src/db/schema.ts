/**
 * CloudBib — SQLite Schema & Migrations
 *
 * Versioned schema migrations for the local SQLite database.
 * Each migration is a sequential SQL script applied in order.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      -- Migration tracking
      CREATE TABLE IF NOT EXISTS _migrations (
        version   INTEGER PRIMARY KEY,
        name      TEXT NOT NULL,
        appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Libraries (personal or group)
      CREATE TABLE libraries (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('personal','group')),
        groupId     TEXT,
        driveRootId TEXT,
        createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
        modifiedAt  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Items (citation metadata)
      CREATE TABLE items (
        id          TEXT PRIMARY KEY,
        libraryId   TEXT NOT NULL REFERENCES libraries(id),
        itemType    TEXT NOT NULL DEFAULT 'journalArticle',
        title       TEXT,
        authors     TEXT,
        year        TEXT,
        journal     TEXT,
        volume      TEXT,
        issue       TEXT,
        pages       TEXT,
        doi         TEXT,
        isbn        TEXT,
        abstract    TEXT,
        tags        TEXT,
        extra       TEXT,
        createdBy   TEXT,
        createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
        modifiedAt  TEXT NOT NULL DEFAULT (datetime('now')),
        version     INTEGER NOT NULL DEFAULT 1,
        deleted     INTEGER NOT NULL DEFAULT 0
      );

      -- Attachments
      CREATE TABLE attachments (
        id              TEXT PRIMARY KEY,
        itemId          TEXT NOT NULL REFERENCES items(id),
        filename        TEXT NOT NULL,
        mime            TEXT NOT NULL DEFAULT 'application/pdf',
        size            INTEGER,
        checksum        TEXT NOT NULL,
        driveFileId     TEXT,
        parentFolderId  TEXT,
        sharedDriveId   TEXT,
        driveWebLink    TEXT,
        driveRevision   TEXT,
        createdBy       TEXT,
        createdAt       TEXT NOT NULL DEFAULT (datetime('now')),
        modifiedAt      TEXT NOT NULL DEFAULT (datetime('now')),
        version         INTEGER NOT NULL DEFAULT 1
      );

      -- Annotation sets
      CREATE TABLE annotation_sets (
        id              TEXT PRIMARY KEY,
        attachmentId    TEXT NOT NULL REFERENCES attachments(id),
        annotations     TEXT NOT NULL DEFAULT '[]',
        driveFileId     TEXT,
        driveRevision   TEXT,
        localVersion    INTEGER NOT NULL DEFAULT 1,
        remoteVersion   INTEGER NOT NULL DEFAULT 0,
        isDirty         INTEGER NOT NULL DEFAULT 0,
        createdBy       TEXT,
        createdAt       TEXT NOT NULL DEFAULT (datetime('now')),
        modifiedAt      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Upload queue
      CREATE TABLE upload_queue (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL CHECK(type IN ('pdf','annotation','metadata')),
        targetId    TEXT NOT NULL,
        localPath   TEXT,
        status      TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','uploading','failed','completed')),
        retryCount  INTEGER NOT NULL DEFAULT 0,
        maxRetries  INTEGER NOT NULL DEFAULT 5,
        errorMsg    TEXT,
        createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
        nextRetryAt TEXT
      );

      -- Sync state
      CREATE TABLE sync_state (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Indexes
      CREATE INDEX idx_items_library ON items(libraryId);
      CREATE INDEX idx_items_modified ON items(modifiedAt);
      CREATE INDEX idx_attachments_item ON attachments(itemId);
      CREATE INDEX idx_attachments_checksum ON attachments(checksum);
      CREATE INDEX idx_annotation_sets_attachment ON annotation_sets(attachmentId);
      CREATE INDEX idx_upload_queue_status ON upload_queue(status);
    `,
  },
];

/**
 * Returns the SQL to ensure the _migrations table exists.
 */
export function getBootstrapSQL(): string {
  return `CREATE TABLE IF NOT EXISTS _migrations (
    version   INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );`;
}
