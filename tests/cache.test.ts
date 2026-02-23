/**
 * CloudBib — Cache Service Tests
 *
 * Tests local PDF caching, checksum computation, and cache stats.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CacheService, computeSHA256 } from '../src/services/cache.service';

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let tmpDir: string;
let cacheService: CacheService;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudbib-test-'));
  cacheService = new CacheService(path.join(tmpDir, 'cache'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// computeSHA256
// ---------------------------------------------------------------------------

describe('computeSHA256', () => {
  test('computes correct SHA-256 for a known file', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world');

    const hash = await computeSHA256(filePath);
    // SHA-256 of "hello world"
    expect(hash).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
    );
  });

  test('produces different hashes for different content', async () => {
    const file1 = path.join(tmpDir, 'a.txt');
    const file2 = path.join(tmpDir, 'b.txt');
    fs.writeFileSync(file1, 'content A');
    fs.writeFileSync(file2, 'content B');

    const hash1 = await computeSHA256(file1);
    const hash2 = await computeSHA256(file2);
    expect(hash1).not.toBe(hash2);
  });

  test('rejects for non-existent file', async () => {
    await expect(computeSHA256('/nonexistent')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// CacheService
// ---------------------------------------------------------------------------

describe('CacheService', () => {
  test('getPdfPath returns null for uncached checksum', () => {
    expect(cacheService.getPdfPath('abc123')).toBeNull();
  });

  test('storePdf caches a file and getPdfPath returns it', async () => {
    const src = path.join(tmpDir, 'source.pdf');
    fs.writeFileSync(src, 'fake PDF content');

    const checksum = await computeSHA256(src);
    const cached = await cacheService.storePdf(checksum, src);

    expect(fs.existsSync(cached)).toBe(true);
    expect(cacheService.getPdfPath(checksum)).toBe(cached);
  });

  test('storePdf does not overwrite existing cache', async () => {
    const src1 = path.join(tmpDir, 'source1.pdf');
    const src2 = path.join(tmpDir, 'source2.pdf');
    fs.writeFileSync(src1, 'same content');
    fs.writeFileSync(src2, 'same content');

    const checksum = await computeSHA256(src1);
    const cached1 = await cacheService.storePdf(checksum, src1);
    const cached2 = await cacheService.storePdf(checksum, src2);

    expect(cached1).toBe(cached2);
  });

  test('isValid returns true for valid cached file', async () => {
    const src = path.join(tmpDir, 'valid.pdf');
    fs.writeFileSync(src, 'valid content');
    const checksum = await computeSHA256(src);
    const cached = await cacheService.storePdf(checksum, src);

    expect(await cacheService.isValid(cached, checksum)).toBe(true);
  });

  test('isValid returns false for tampered file', async () => {
    const src = path.join(tmpDir, 'tamper.pdf');
    fs.writeFileSync(src, 'original');
    const checksum = await computeSHA256(src);
    const cached = await cacheService.storePdf(checksum, src);

    // Tamper with the cached file
    fs.writeFileSync(cached, 'tampered content');
    expect(await cacheService.isValid(cached, checksum)).toBe(false);
  });

  test('isValid returns false for non-existent path', async () => {
    expect(await cacheService.isValid('/nonexistent', 'abc')).toBe(false);
  });

  test('allocatePath returns expected path', () => {
    const p = cacheService.allocatePath('deadbeef');
    expect(p).toContain('deadbeef.pdf');
    expect(p).toContain('pdfs');
  });

  test('getAnnotationPath returns expected path', () => {
    const p = cacheService.getAnnotationPath('att-123');
    expect(p).toContain('att-123.json');
    expect(p).toContain('annotations');
  });

  test('getCacheStats returns correct counts', async () => {
    const stats0 = cacheService.getCacheStats();
    expect(stats0.pdfCount).toBe(0);
    expect(stats0.totalSizeBytes).toBe(0);

    // Add a PDF
    const src = path.join(tmpDir, 'stats.pdf');
    fs.writeFileSync(src, 'some pdf data here');
    const checksum = await computeSHA256(src);
    await cacheService.storePdf(checksum, src);

    const stats1 = cacheService.getCacheStats();
    expect(stats1.pdfCount).toBe(1);
    expect(stats1.totalSizeBytes).toBeGreaterThan(0);
  });
});
