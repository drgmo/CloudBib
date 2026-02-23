/**
 * CloudBib — Google Drive Service
 *
 * Handles all interactions with the Google Drive API:
 * folder management, resumable uploads, downloads, and metadata.
 *
 * This module defines the interface and a concrete implementation
 * that can be swapped for testing via dependency injection.
 */

import type {
  DriveUploadOptions,
  DriveFileMetadata,
  AnnotationSidecar,
} from '../models/types';

// ---------------------------------------------------------------------------
// Drive Service Interface
// ---------------------------------------------------------------------------

export interface IDriveService {
  /**
   * Ensures a subfolder exists under `parentId`. Creates it if missing.
   * Returns the folder's Drive ID.
   */
  ensureFolder(parentId: string, folderName: string): Promise<string>;

  /**
   * Uploads a file using resumable upload protocol.
   * Returns metadata of the created file.
   */
  uploadResumable(options: DriveUploadOptions): Promise<DriveFileMetadata>;

  /**
   * Downloads a Drive file to `destPath`.
   */
  downloadFile(fileId: string, destPath: string): Promise<void>;

  /**
   * Downloads a JSON file from Drive and parses it.
   */
  downloadJSON<T = AnnotationSidecar>(fileId: string): Promise<T>;

  /**
   * Gets metadata for a Drive file.
   */
  getFileMetadata(fileId: string): Promise<DriveFileMetadata>;

  /**
   * Creates a new file (small content, e.g., JSON sidecar).
   */
  createFile(options: DriveUploadOptions): Promise<DriveFileMetadata>;

  /**
   * Updates an existing file's content.
   */
  updateFile(
    fileId: string,
    content: string,
    mimeType: string
  ): Promise<DriveFileMetadata>;

  /**
   * Checks if the service can reach Google Drive (connectivity test).
   */
  isOnline(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Sanitize filename for Drive
// ---------------------------------------------------------------------------

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// Build Drive file name for a PDF
// ---------------------------------------------------------------------------

export function buildDriveFileName(checksum: string, originalName: string): string {
  const prefix = checksum.slice(0, 8);
  const sanitized = sanitizeFilename(originalName);
  return `${prefix}_${sanitized}`;
}
