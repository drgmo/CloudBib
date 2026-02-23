/**
 * CloudBib — Cache Service
 *
 * Manages the local PDF cache and annotation cache.
 * PDFs are stored by SHA-256 checksum for deduplication.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ICacheService {
  getPdfPath(checksum: string): string | null;
  isValid(localPath: string, expectedChecksum: string): Promise<boolean>;
  allocatePath(checksum: string): string;
  storePdf(checksum: string, sourcePath: string): Promise<string>;
  getAnnotationPath(attachmentId: string): string;
  getCacheStats(): { pdfCount: number; totalSizeBytes: number };
}

export class CacheService implements ICacheService {
  private readonly pdfsDir: string;
  private readonly annotationsDir: string;

  constructor(private readonly cacheRoot: string) {
    this.pdfsDir = path.join(cacheRoot, 'pdfs');
    this.annotationsDir = path.join(cacheRoot, 'annotations');
    fs.mkdirSync(this.pdfsDir, { recursive: true });
    fs.mkdirSync(this.annotationsDir, { recursive: true });
  }

  /**
   * Returns the cached PDF path if it exists, or null.
   */
  getPdfPath(checksum: string): string | null {
    const p = path.join(this.pdfsDir, `${checksum}.pdf`);
    return fs.existsSync(p) ? p : null;
  }

  /**
   * Validates a cached file against expected checksum.
   */
  async isValid(localPath: string, expectedChecksum: string): Promise<boolean> {
    if (!fs.existsSync(localPath)) return false;
    const actual = await computeSHA256(localPath);
    return actual === expectedChecksum;
  }

  /**
   * Returns the path where a PDF with the given checksum should be stored.
   */
  allocatePath(checksum: string): string {
    return path.join(this.pdfsDir, `${checksum}.pdf`);
  }

  /**
   * Copies a PDF into the cache, keyed by checksum.
   */
  async storePdf(checksum: string, sourcePath: string): Promise<string> {
    const dest = this.allocatePath(checksum);
    if (!fs.existsSync(dest)) {
      await fs.promises.copyFile(sourcePath, dest);
    }
    return dest;
  }

  /**
   * Returns the local annotation cache path for an attachment.
   */
  getAnnotationPath(attachmentId: string): string {
    return path.join(this.annotationsDir, `${attachmentId}.json`);
  }

  /**
   * Returns basic cache statistics.
   */
  getCacheStats(): { pdfCount: number; totalSizeBytes: number } {
    let pdfCount = 0;
    let totalSizeBytes = 0;

    if (fs.existsSync(this.pdfsDir)) {
      const files = fs.readdirSync(this.pdfsDir);
      for (const f of files) {
        if (f.endsWith('.pdf')) {
          pdfCount++;
          const stat = fs.statSync(path.join(this.pdfsDir, f));
          totalSizeBytes += stat.size;
        }
      }
    }

    return { pdfCount, totalSizeBytes };
  }
}

/**
 * Computes the SHA-256 hash of a file.
 */
export async function computeSHA256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
