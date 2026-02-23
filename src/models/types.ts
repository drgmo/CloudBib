/**
 * CloudBib — Core Type Definitions
 *
 * All domain entities used across services, database, and API layers.
 */

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export type LibraryType = 'personal' | 'group';

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ItemType =
  | 'journalArticle'
  | 'book'
  | 'bookSection'
  | 'conferencePaper'
  | 'thesis'
  | 'report'
  | 'webpage'
  | 'preprint'
  | 'patent'
  | 'other';

export type UploadStatus = 'pending' | 'uploading' | 'failed' | 'completed';

export type UploadType = 'pdf' | 'annotation' | 'metadata';

export type AnnotationType = 'highlight' | 'note' | 'area';

export type ConflictResolution = 'keepLocal' | 'keepRemote' | 'merge';

// ---------------------------------------------------------------------------
// Core Entities
// ---------------------------------------------------------------------------

export interface Library {
  id: string;
  name: string;
  type: LibraryType;
  groupId: string | null;
  driveRootId: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface Author {
  given: string;
  family: string;
}

export interface Item {
  id: string;
  libraryId: string;
  itemType: ItemType;
  title: string | null;
  authors: Author[];
  year: string | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  isbn: string | null;
  abstract: string | null;
  tags: string[];
  extra: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  modifiedAt: string;
  version: number;
  deleted: boolean;
}

export interface Attachment {
  id: string;
  itemId: string;
  filename: string;
  mime: string;
  size: number | null;
  checksum: string;
  driveFileId: string | null;
  parentFolderId: string | null;
  sharedDriveId: string | null;
  driveWebLink: string | null;
  driveRevision: string | null;
  createdBy: string | null;
  createdAt: string;
  modifiedAt: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  page: number;
  rects?: Rect[];
  position?: Position;
  color?: string;
  text?: string;
  content?: string;
  comment?: string;
  createdBy: string;
  createdAt: string;
  modifiedAt: string;
}

export interface AnnotationSidecar {
  schemaVersion: number;
  attachmentId: string;
  lastModified: string;
  version: number;
  createdBy: string;
  annotations: Annotation[];
}

export interface AnnotationSet {
  id: string;
  attachmentId: string;
  annotations: Annotation[];
  driveFileId: string | null;
  driveRevision: string | null;
  localVersion: number;
  remoteVersion: number;
  isDirty: boolean;
  createdBy: string | null;
  createdAt: string;
  modifiedAt: string;
}

// ---------------------------------------------------------------------------
// Upload Queue
// ---------------------------------------------------------------------------

export interface UploadQueueEntry {
  id: string;
  type: UploadType;
  targetId: string;
  localPath: string | null;
  status: UploadStatus;
  retryCount: number;
  maxRetries: number;
  errorMsg: string | null;
  createdAt: string;
  nextRetryAt: string | null;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: number;
}

export interface SyncConflict {
  itemId: string;
  localVersion: number;
  remoteVersion: number;
  localData: Partial<Item>;
  remoteData: Partial<Item>;
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

export interface DriveUploadOptions {
  name: string;
  mimeType: string;
  parents: string[];
  localPath?: string;
  content?: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  headRevisionId: string;
  webViewLink: string;
  parents: string[];
}

// ---------------------------------------------------------------------------
// Viewer Session
// ---------------------------------------------------------------------------

export interface ViewerSession {
  pdfPath: string;
  annotations: Annotation[];
  annotationSetId: string;
  attachmentId: string;
}

// ---------------------------------------------------------------------------
// Citation Export
// ---------------------------------------------------------------------------

export type CitationFormat = 'bibtex' | 'csljson' | 'ris';

export interface CslJsonEntry {
  id: string;
  type: string;
  title?: string;
  author?: Array<{ given: string; family: string }>;
  issued?: { 'date-parts': Array<Array<number | string>> };
  'container-title'?: string;
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  ISBN?: string;
  abstract?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Database Row types (raw from SQLite — JSON fields as strings)
// ---------------------------------------------------------------------------

export interface ItemRow {
  id: string;
  libraryId: string;
  itemType: string;
  title: string | null;
  authors: string | null;
  year: string | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  isbn: string | null;
  abstract: string | null;
  tags: string | null;
  extra: string | null;
  createdBy: string | null;
  createdAt: string;
  modifiedAt: string;
  version: number;
  deleted: number;
}

export interface AnnotationSetRow {
  id: string;
  attachmentId: string;
  annotations: string;
  driveFileId: string | null;
  driveRevision: string | null;
  localVersion: number;
  remoteVersion: number;
  isDirty: number;
  createdBy: string | null;
  createdAt: string;
  modifiedAt: string;
}
