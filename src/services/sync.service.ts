/**
 * CloudBib — Sync Service
 *
 * Implements the sync loop for pushing/pulling changes between
 * the local SQLite database and the remote backend, and processing
 * the upload queue for Drive operations.
 */

import type Database from 'better-sqlite3';
import type { IDriveService } from './drive.service';
import type { ICacheService } from './cache.service';
import type {
  SyncResult,
  ItemRow,
  Attachment,
  AnnotationSetRow,
  UploadQueueEntry,
} from '../models/types';
import { rowToItem } from './library.service';
import { buildDriveFileName } from './drive.service';
import { buildSidecar, rowToAnnotationSet } from './annotation.service';

// ---------------------------------------------------------------------------
// Backend API Interface (for dependency injection / mocking)
// ---------------------------------------------------------------------------

export interface IBackendApi {
  getChanges(since: string): Promise<{ items: ItemRow[] }>;
  pushItem(item: ItemRow): Promise<void>;
  isOnline(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Sync Service
// ---------------------------------------------------------------------------

export class SyncService {
  constructor(
    private readonly db: Database.Database,
    private readonly driveService: IDriveService,
    private readonly cacheService: ICacheService,
    private readonly backendApi: IBackendApi,
    private readonly currentUserId: () => string
  ) {}

  /**
   * Main sync loop. Call periodically (e.g., every 5 minutes) or on-demand.
   */
  async syncLoop(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: 0 };

    try {
      // 1. Get last sync timestamp
      const lastSync =
        (
          this.db
            .prepare("SELECT value FROM sync_state WHERE key = 'lastSyncTimestamp'")
            .get() as { value: string } | undefined
        )?.value ?? '1970-01-01T00:00:00Z';

      // 2. Pull remote changes
      try {
        const remoteChanges = await this.backendApi.getChanges(lastSync);

        for (const remote of remoteChanges.items) {
          const local = this.db
            .prepare('SELECT * FROM items WHERE id = ?')
            .get(remote.id) as ItemRow | undefined;

          if (!local) {
            // New remote item — insert locally
            this.db
              .prepare(
                `INSERT INTO items (id, libraryId, itemType, title, authors, year,
                 journal, volume, issue, pages, doi, isbn, abstract, tags, extra,
                 version, createdBy, createdAt, modifiedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .run(
                remote.id,
                remote.libraryId,
                remote.itemType,
                remote.title,
                remote.authors,
                remote.year,
                remote.journal,
                remote.volume,
                remote.issue,
                remote.pages,
                remote.doi,
                remote.isbn,
                remote.abstract,
                remote.tags,
                remote.extra,
                remote.version,
                remote.createdBy,
                remote.createdAt,
                remote.modifiedAt
              );
            result.pulled++;
          } else if (remote.version > local.version) {
            const localDirty = local.modifiedAt > lastSync;
            if (localDirty) {
              // Conflict — both sides changed
              result.conflicts++;
            } else {
              // Remote is newer, no local changes → safe overwrite
              this.db
                .prepare(
                  `UPDATE items SET title = ?, authors = ?, year = ?,
                   journal = ?, volume = ?, issue = ?, pages = ?,
                   doi = ?, isbn = ?, abstract = ?, tags = ?, extra = ?,
                   version = ?, modifiedAt = ?, deleted = ?
                   WHERE id = ?`
                )
                .run(
                  remote.title,
                  remote.authors,
                  remote.year,
                  remote.journal,
                  remote.volume,
                  remote.issue,
                  remote.pages,
                  remote.doi,
                  remote.isbn,
                  remote.abstract,
                  remote.tags,
                  remote.extra,
                  remote.version,
                  remote.modifiedAt,
                  remote.deleted,
                  remote.id
                );
              result.pulled++;
            }
          }
        }
      } catch {
        // Backend unreachable — skip pull
        result.errors++;
      }

      // 3. Push local changes
      const localChanges = this.db
        .prepare("SELECT * FROM items WHERE modifiedAt > ?")
        .all(lastSync) as ItemRow[];

      for (const item of localChanges) {
        try {
          await this.backendApi.pushItem(item);
          result.pushed++;
        } catch (err: unknown) {
          const status = (err as { status?: number }).status;
          if (status === 409) {
            result.conflicts++;
          } else {
            result.errors++;
          }
        }
      }

      // 4. Process upload queue
      await this.processUploadQueue(result);

      // 5. Update sync timestamp
      this.db
        .prepare(
          `INSERT OR REPLACE INTO sync_state (key, value, updatedAt)
           VALUES ('lastSyncTimestamp', ?, datetime('now'))`
        )
        .run(new Date().toISOString());
    } catch {
      result.errors++;
    }

    return result;
  }

  /**
   * Processes pending items in the upload queue.
   */
  async processUploadQueue(result: SyncResult): Promise<void> {
    const pendingUploads = this.db
      .prepare(
        "SELECT * FROM upload_queue WHERE status = 'pending' ORDER BY createdAt"
      )
      .all() as UploadQueueEntry[];

    for (const upload of pendingUploads) {
      try {
        if (upload.type === 'pdf') {
          await this.processPdfUpload(upload);
        } else if (upload.type === 'annotation') {
          await this.processAnnotationUpload(upload);
        }
        this.db
          .prepare("UPDATE upload_queue SET status = 'completed' WHERE id = ?")
          .run(upload.id);
      } catch (err) {
        const newRetry = upload.retryCount + 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (newRetry >= upload.maxRetries) {
          this.db
            .prepare(
              "UPDATE upload_queue SET status = 'failed', errorMsg = ?, retryCount = ? WHERE id = ?"
            )
            .run(errMsg, newRetry, upload.id);
        } else {
          const nextRetry = new Date(
            Date.now() + Math.pow(2, newRetry) * 1000
          ).toISOString();
          this.db
            .prepare(
              'UPDATE upload_queue SET retryCount = ?, nextRetryAt = ?, errorMsg = ? WHERE id = ?'
            )
            .run(newRetry, nextRetry, errMsg, upload.id);
        }
        result.errors++;
      }
    }
  }

  private async processPdfUpload(upload: UploadQueueEntry): Promise<void> {
    const attachment = this.db
      .prepare('SELECT * FROM attachments WHERE id = ?')
      .get(upload.targetId) as Attachment | undefined;

    if (!attachment) return;
    if (attachment.driveFileId) return; // Already uploaded

    const item = this.db
      .prepare('SELECT * FROM items WHERE id = ?')
      .get(attachment.itemId) as ItemRow | undefined;
    if (!item) return;

    const library = this.db
      .prepare('SELECT * FROM libraries WHERE id = ?')
      .get(item.libraryId) as { driveRootId: string } | undefined;
    if (!library?.driveRootId) return;

    const localPath =
      upload.localPath ?? this.cacheService.getPdfPath(attachment.checksum);
    if (!localPath) return;

    const pdfsFolderId = await this.driveService.ensureFolder(
      library.driveRootId,
      'pdfs'
    );

    const driveFile = await this.driveService.uploadResumable({
      name: buildDriveFileName(attachment.checksum, attachment.filename),
      mimeType: 'application/pdf',
      parents: [pdfsFolderId],
      localPath,
    });

    this.db
      .prepare(
        `UPDATE attachments SET driveFileId = ?, parentFolderId = ?,
         sharedDriveId = ?, driveWebLink = ?, driveRevision = ?
         WHERE id = ?`
      )
      .run(
        driveFile.id,
        pdfsFolderId,
        library.driveRootId,
        driveFile.webViewLink,
        driveFile.headRevisionId,
        attachment.id
      );
  }

  private async processAnnotationUpload(upload: UploadQueueEntry): Promise<void> {
    const annRow = this.db
      .prepare('SELECT * FROM annotation_sets WHERE id = ?')
      .get(upload.targetId) as AnnotationSetRow | undefined;

    if (!annRow) return;

    const annotationSet = rowToAnnotationSet(annRow);
    const attachment = this.db
      .prepare('SELECT * FROM attachments WHERE id = ?')
      .get(annotationSet.attachmentId) as Attachment | undefined;
    if (!attachment) return;

    const item = this.db
      .prepare('SELECT * FROM items WHERE id = ?')
      .get(attachment.itemId) as ItemRow | undefined;
    if (!item) return;

    const library = this.db
      .prepare('SELECT * FROM libraries WHERE id = ?')
      .get(item.libraryId) as { driveRootId: string } | undefined;
    if (!library?.driveRootId) return;

    const annotationsFolderId = await this.driveService.ensureFolder(
      library.driveRootId,
      'annotations'
    );

    const sidecar = buildSidecar(
      annotationSet.attachmentId,
      annotationSet.annotations,
      annotationSet.localVersion,
      this.currentUserId()
    );

    const content = JSON.stringify(sidecar, null, 2);

    if (annotationSet.driveFileId) {
      const updated = await this.driveService.updateFile(
        annotationSet.driveFileId,
        content,
        'application/json'
      );
      this.db
        .prepare(
          `UPDATE annotation_sets SET driveRevision = ?, remoteVersion = ?, isDirty = 0 WHERE id = ?`
        )
        .run(updated.headRevisionId, annotationSet.localVersion, annotationSet.id);
    } else {
      const driveFile = await this.driveService.createFile({
        name: `${annotationSet.attachmentId}.json`,
        mimeType: 'application/json',
        parents: [annotationsFolderId],
        content,
      });
      this.db
        .prepare(
          `UPDATE annotation_sets SET driveFileId = ?, driveRevision = ?, remoteVersion = ?, isDirty = 0 WHERE id = ?`
        )
        .run(
          driveFile.id,
          driveFile.headRevisionId,
          annotationSet.localVersion,
          annotationSet.id
        );
    }
  }
}
