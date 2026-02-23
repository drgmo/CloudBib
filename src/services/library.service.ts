/**
 * CloudBib — Library Service
 *
 * Core business logic for managing libraries, items, and attachments.
 * Orchestrates interactions between the local database, Drive service,
 * and cache service.
 */

import type Database from 'better-sqlite3';
import type { IDriveService } from './drive.service';
import type { ICacheService } from './cache.service';
import { computeSHA256 } from './cache.service';
import { buildDriveFileName } from './drive.service';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import type {
  Library,
  Item,
  ItemRow,
  Attachment,
  Author,
  ItemType,
  ViewerSession,
  Annotation,
  AnnotationSetRow,
} from '../models/types';
import { mergeAnnotations, rowToAnnotationSet } from './annotation.service';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

// ---------------------------------------------------------------------------
// Row → Domain Helpers
// ---------------------------------------------------------------------------

export function rowToItem(row: ItemRow): Item {
  return {
    ...row,
    itemType: row.itemType as ItemType,
    authors: row.authors ? (JSON.parse(row.authors) as Author[]) : [],
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    extra: row.extra ? (JSON.parse(row.extra) as Record<string, unknown>) : {},
    deleted: row.deleted === 1,
  };
}

// ---------------------------------------------------------------------------
// Library Service
// ---------------------------------------------------------------------------

export class LibraryService {
  constructor(
    private readonly db: Database.Database,
    private readonly driveService: IDriveService,
    private readonly cacheService: ICacheService,
    private readonly currentUserId: () => string
  ) {}

  // -------------------------------------------------------------------------
  // Library CRUD
  // -------------------------------------------------------------------------

  createLibrary(name: string, type: 'personal' | 'group', groupId?: string): Library {
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO libraries (id, name, type, groupId)
         VALUES (?, ?, ?, ?)`
      )
      .run(id, name, type, groupId ?? null);

    return this.getLibrary(id)!;
  }

  getLibrary(id: string): Library | null {
    const row = this.db
      .prepare('SELECT * FROM libraries WHERE id = ?')
      .get(id) as Library | undefined;
    return row ?? null;
  }

  listLibraries(): Library[] {
    return this.db.prepare('SELECT * FROM libraries ORDER BY name').all() as Library[];
  }

  // -------------------------------------------------------------------------
  // Item CRUD
  // -------------------------------------------------------------------------

  createItem(
    libraryId: string,
    data: {
      title?: string;
      itemType?: ItemType;
      authors?: Author[];
      year?: string;
      journal?: string;
      volume?: string;
      issue?: string;
      pages?: string;
      doi?: string;
      isbn?: string;
      abstract?: string;
      tags?: string[];
    }
  ): Item {
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO items (id, libraryId, itemType, title, authors, year,
         journal, volume, issue, pages, doi, isbn, abstract, tags, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        libraryId,
        data.itemType ?? 'journalArticle',
        data.title ?? null,
        data.authors ? JSON.stringify(data.authors) : null,
        data.year ?? null,
        data.journal ?? null,
        data.volume ?? null,
        data.issue ?? null,
        data.pages ?? null,
        data.doi ?? null,
        data.isbn ?? null,
        data.abstract ?? null,
        data.tags ? JSON.stringify(data.tags) : null,
        this.currentUserId()
      );

    return this.getItem(id)!;
  }

  getItem(id: string): Item | null {
    const row = this.db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
      | ItemRow
      | undefined;
    return row ? rowToItem(row) : null;
  }

  listItems(libraryId: string): Item[] {
    const rows = this.db
      .prepare('SELECT * FROM items WHERE libraryId = ? AND deleted = 0 ORDER BY title')
      .all(libraryId) as ItemRow[];
    return rows.map(rowToItem);
  }

  updateItem(id: string, data: Partial<Item>): Item {
    const existing = this.getItem(id);
    if (!existing) throw new NotFoundError(`Item not found: ${id}`);

    this.db
      .prepare(
        `UPDATE items SET
           title = ?, authors = ?, year = ?, journal = ?, volume = ?,
           issue = ?, pages = ?, doi = ?, isbn = ?, abstract = ?, tags = ?,
           version = version + 1, modifiedAt = datetime('now')
         WHERE id = ?`
      )
      .run(
        data.title ?? existing.title,
        data.authors ? JSON.stringify(data.authors) : JSON.stringify(existing.authors),
        data.year ?? existing.year,
        data.journal ?? existing.journal,
        data.volume ?? existing.volume,
        data.issue ?? existing.issue,
        data.pages ?? existing.pages,
        data.doi ?? existing.doi,
        data.isbn ?? existing.isbn,
        data.abstract ?? existing.abstract,
        data.tags ? JSON.stringify(data.tags) : JSON.stringify(existing.tags),
        id
      );

    return this.getItem(id)!;
  }

  deleteItem(id: string): void {
    this.db
      .prepare("UPDATE items SET deleted = 1, modifiedAt = datetime('now'), version = version + 1 WHERE id = ?")
      .run(id);
  }

  // -------------------------------------------------------------------------
  // Attachment helpers
  // -------------------------------------------------------------------------

  getAttachment(id: string): Attachment | null {
    const row = this.db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
      | Attachment
      | undefined;
    return row ?? null;
  }

  getAttachmentsForItem(itemId: string): Attachment[] {
    return this.db
      .prepare('SELECT * FROM attachments WHERE itemId = ?')
      .all(itemId) as Attachment[];
  }

  // -------------------------------------------------------------------------
  // Core Use-Case: Add PDF to Group
  // -------------------------------------------------------------------------

  async addPdfToGroup(groupId: string, localPdfPath: string): Promise<Item> {
    // 1. Validate file exists
    if (!fs.existsSync(localPdfPath)) {
      throw new NotFoundError(`File not found: ${localPdfPath}`);
    }

    // 2. Compute checksum
    const checksum = await computeSHA256(localPdfPath);
    const fileStats = fs.statSync(localPdfPath);
    const filename = path.basename(localPdfPath);

    // 3. Find the library for this group
    const library = this.db
      .prepare('SELECT * FROM libraries WHERE groupId = ?')
      .get(groupId) as Library | undefined;
    if (!library) throw new NotFoundError(`Group library not found for group: ${groupId}`);

    // 4. Check for duplicates in this library
    const existing = this.db
      .prepare(
        `SELECT a.* FROM attachments a
         JOIN items i ON a.itemId = i.id
         WHERE a.checksum = ? AND i.libraryId = ? AND i.deleted = 0`
      )
      .get(checksum, library.id) as Attachment | undefined;

    if (existing) {
      throw new DuplicateError(
        `PDF already exists in this group library: ${existing.filename}`
      );
    }

    // 5. Upload to Drive
    let driveFile;
    try {
      const pdfsFolderId = await this.driveService.ensureFolder(
        library.driveRootId!,
        'pdfs'
      );

      driveFile = await this.driveService.uploadResumable({
        name: buildDriveFileName(checksum, filename),
        mimeType: 'application/pdf',
        parents: [pdfsFolderId],
        localPath: localPdfPath,
      });
    } catch (err) {
      // Queue for retry if upload fails
      const queueId = uuid();
      const itemId = uuid();
      const attachmentId = uuid();

      this.db.transaction(() => {
        this.db
          .prepare(
            `INSERT INTO items (id, libraryId, title, createdBy, itemType)
             VALUES (?, ?, ?, ?, 'journalArticle')`
          )
          .run(itemId, library.id, filename.replace(/\.pdf$/i, ''), this.currentUserId());

        this.db
          .prepare(
            `INSERT INTO attachments (id, itemId, filename, size, checksum, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(attachmentId, itemId, filename, fileStats.size, checksum, this.currentUserId());

        this.db
          .prepare(
            `INSERT INTO annotation_sets (id, attachmentId, createdBy)
             VALUES (?, ?, ?)`
          )
          .run(uuid(), attachmentId, this.currentUserId());

        this.db
          .prepare(
            `INSERT INTO upload_queue (id, type, targetId, localPath, status)
             VALUES (?, 'pdf', ?, ?, 'pending')`
          )
          .run(queueId, attachmentId, localPdfPath);
      })();

      // Still cache locally
      await this.cacheService.storePdf(checksum, localPdfPath);
      return this.getItem(itemId)!;
    }

    // 6. Create item + attachment in local DB
    const itemId = uuid();
    const attachmentId = uuid();

    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO items (id, libraryId, title, createdBy, itemType)
           VALUES (?, ?, ?, ?, 'journalArticle')`
        )
        .run(itemId, library.id, filename.replace(/\.pdf$/i, ''), this.currentUserId());

      this.db
        .prepare(
          `INSERT INTO attachments (id, itemId, filename, size, checksum,
           driveFileId, parentFolderId, sharedDriveId, driveWebLink, driveRevision, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          attachmentId,
          itemId,
          filename,
          fileStats.size,
          checksum,
          driveFile.id,
          driveFile.parents[0],
          library.driveRootId,
          driveFile.webViewLink,
          driveFile.headRevisionId,
          this.currentUserId()
        );

      this.db
        .prepare(
          `INSERT INTO annotation_sets (id, attachmentId, createdBy)
           VALUES (?, ?, ?)`
        )
        .run(uuid(), attachmentId, this.currentUserId());
    })();

    // 7. Cache locally
    await this.cacheService.storePdf(checksum, localPdfPath);

    return this.getItem(itemId)!;
  }

  // -------------------------------------------------------------------------
  // Core Use-Case: Open PDF for Annotation
  // -------------------------------------------------------------------------

  async openPdfForAnnotate(attachmentId: string): Promise<ViewerSession> {
    const attachment = this.getAttachment(attachmentId);
    if (!attachment) throw new NotFoundError('Attachment not found');

    // 1. Ensure PDF is in local cache
    let localPath = this.cacheService.getPdfPath(attachment.checksum);

    if (!localPath || !(await this.cacheService.isValid(localPath, attachment.checksum))) {
      if (!attachment.driveFileId) {
        throw new NotFoundError('PDF not uploaded to Drive yet and not in cache');
      }
      localPath = this.cacheService.allocatePath(attachment.checksum);
      await this.driveService.downloadFile(attachment.driveFileId, localPath);

      // Verify integrity
      const downloadedHash = await computeSHA256(localPath);
      if (downloadedHash !== attachment.checksum) {
        throw new IntegrityError('Downloaded file checksum mismatch');
      }
    }

    // 2. Load annotations
    const annRow = this.db
      .prepare('SELECT * FROM annotation_sets WHERE attachmentId = ?')
      .get(attachmentId) as AnnotationSetRow | undefined;

    if (!annRow) throw new NotFoundError('Annotation set not found');

    const annotationSet = rowToAnnotationSet(annRow);
    let annotations = annotationSet.annotations;

    // 3. Check for newer remote annotations
    if (annotationSet.driveFileId) {
      try {
        const remoteMeta = await this.driveService.getFileMetadata(
          annotationSet.driveFileId
        );
        if (remoteMeta.headRevisionId !== annotationSet.driveRevision) {
          const remoteData = await this.driveService.downloadJSON(
            annotationSet.driveFileId
          );
          annotations = mergeAnnotations(annotations, remoteData.annotations);
          this.db
            .prepare(
              `UPDATE annotation_sets
               SET annotations = ?, driveRevision = ?, remoteVersion = ?
               WHERE id = ?`
            )
            .run(
              JSON.stringify(annotations),
              remoteMeta.headRevisionId,
              remoteData.version,
              annotationSet.id
            );
        }
      } catch {
        // Offline — use local annotations
      }
    }

    return {
      pdfPath: localPath!,
      annotations,
      annotationSetId: annotationSet.id,
      attachmentId,
    };
  }

  // -------------------------------------------------------------------------
  // Core Use-Case: Save Annotations
  // -------------------------------------------------------------------------

  async saveAnnotations(
    attachmentId: string,
    annotations: Annotation[]
  ): Promise<void> {
    const annRow = this.db
      .prepare('SELECT * FROM annotation_sets WHERE attachmentId = ?')
      .get(attachmentId) as AnnotationSetRow | undefined;

    if (!annRow) throw new NotFoundError('Annotation set not found');

    const annotationSet = rowToAnnotationSet(annRow);
    const newVersion = annotationSet.localVersion + 1;

    // 1. Save locally
    this.db
      .prepare(
        `UPDATE annotation_sets
         SET annotations = ?, localVersion = ?, isDirty = 1, modifiedAt = datetime('now')
         WHERE id = ?`
      )
      .run(JSON.stringify(annotations), newVersion, annotationSet.id);

    // 2. Try to upload to Drive
    try {
      const attachment = this.getAttachment(attachmentId);
      if (!attachment) throw new NotFoundError('Attachment not found');

      const item = this.getItem(attachment.itemId);
      if (!item) throw new NotFoundError('Item not found');

      const library = this.getLibrary(item.libraryId);
      if (!library?.driveRootId) return; // Personal library without Drive

      const sidecarData = {
        schemaVersion: 1,
        attachmentId,
        lastModified: new Date().toISOString(),
        version: newVersion,
        createdBy: this.currentUserId(),
        annotations,
      };

      const annotationsFolderId = await this.driveService.ensureFolder(
        library.driveRootId,
        'annotations'
      );

      if (annotationSet.driveFileId) {
        // Update existing — check for conflicts
        const remoteMeta = await this.driveService.getFileMetadata(
          annotationSet.driveFileId
        );

        if (remoteMeta.headRevisionId !== annotationSet.driveRevision) {
          // CONFLICT: someone else updated
          const remoteData = await this.driveService.downloadJSON(
            annotationSet.driveFileId
          );
          const merged = mergeAnnotations(annotations, remoteData.annotations);
          sidecarData.annotations = merged;
          sidecarData.version = Math.max(newVersion, remoteData.version) + 1;
        }

        const updated = await this.driveService.updateFile(
          annotationSet.driveFileId,
          JSON.stringify(sidecarData, null, 2),
          'application/json'
        );

        this.db
          .prepare(
            `UPDATE annotation_sets
             SET driveRevision = ?, remoteVersion = ?, isDirty = 0, localVersion = ?
             WHERE id = ?`
          )
          .run(
            updated.headRevisionId,
            sidecarData.version,
            sidecarData.version,
            annotationSet.id
          );
      } else {
        // Create new sidecar file
        const driveFile = await this.driveService.createFile({
          name: `${attachmentId}.json`,
          mimeType: 'application/json',
          parents: [annotationsFolderId],
          content: JSON.stringify(sidecarData, null, 2),
        });

        this.db
          .prepare(
            `UPDATE annotation_sets
             SET driveFileId = ?, driveRevision = ?, remoteVersion = ?, isDirty = 0
             WHERE id = ?`
          )
          .run(
            driveFile.id,
            driveFile.headRevisionId,
            newVersion,
            annotationSet.id
          );
      }
    } catch {
      // Offline — queue for later
      this.db
        .prepare(
          `INSERT INTO upload_queue (id, type, targetId, status)
           VALUES (?, 'annotation', ?, 'pending')`
        )
        .run(uuid(), annotationSet.id);
    }
  }
}
