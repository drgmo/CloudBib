/**
 * CloudBib — Drive Service Tests
 *
 * Tests utility functions: filename sanitization, Drive file naming,
 * and retry logic.
 */

import {
  sanitizeFilename,
  buildDriveFileName,
  withRetry,
} from '../src/services/drive.service';

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
  test('removes illegal characters', () => {
    expect(sanitizeFilename('file<>:"/\\|?*.pdf')).toBe('file_________.pdf');
  });

  test('replaces whitespace with underscores', () => {
    expect(sanitizeFilename('my research paper.pdf')).toBe('my_research_paper.pdf');
  });

  test('truncates to 200 characters', () => {
    const longName = 'a'.repeat(250) + '.pdf';
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
  });

  test('handles normal filenames unchanged', () => {
    expect(sanitizeFilename('paper2024.pdf')).toBe('paper2024.pdf');
  });

  test('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildDriveFileName
// ---------------------------------------------------------------------------

describe('buildDriveFileName', () => {
  test('prefixes filename with first 8 chars of checksum', () => {
    const checksum = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const result = buildDriveFileName(checksum, 'paper.pdf');
    expect(result).toBe('abcdef12_paper.pdf');
  });

  test('sanitizes the original filename', () => {
    const checksum = '1234567890abcdef';
    const result = buildDriveFileName(checksum, 'my paper (final).pdf');
    expect(result).toBe('12345678_my_paper_(final).pdf');
  });
});

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  test('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on failure then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('throws after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fail'));

    await expect(withRetry(fn, 2)).rejects.toThrow('always fail');
    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
