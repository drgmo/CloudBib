/**
 * CloudBib — Annotation Service Tests
 *
 * Tests annotation merge logic, sidecar serialization, and row conversion.
 */

import {
  mergeAnnotations,
  buildSidecar,
  parseSidecar,
  rowToAnnotationSet,
} from '../src/services/annotation.service';
import type { Annotation, AnnotationSetRow } from '../src/models/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeHighlight(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'ann-1',
    type: 'highlight',
    page: 1,
    rects: [{ x1: 72, y1: 700, x2: 540, y2: 712 }],
    color: '#FFFF00',
    text: 'highlighted text',
    comment: '',
    createdBy: 'alice@example.com',
    createdAt: '2024-01-01T10:00:00Z',
    modifiedAt: '2024-01-01T10:00:00Z',
    ...overrides,
  };
}

function makeNote(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'ann-2',
    type: 'note',
    page: 2,
    position: { x: 100, y: 500 },
    content: 'A note',
    createdBy: 'bob@example.com',
    createdAt: '2024-01-01T11:00:00Z',
    modifiedAt: '2024-01-01T11:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Merge Tests
// ---------------------------------------------------------------------------

describe('mergeAnnotations', () => {
  test('merges annotations with unique IDs (union)', () => {
    const local = [makeHighlight({ id: 'h1' })];
    const remote = [makeNote({ id: 'n1' })];

    const merged = mergeAnnotations(local, remote);
    expect(merged).toHaveLength(2);
    expect(merged.map((a) => a.id).sort()).toEqual(['h1', 'n1']);
  });

  test('keeps later modifiedAt when same ID exists', () => {
    const local = [
      makeHighlight({
        id: 'shared',
        comment: 'local edit',
        modifiedAt: '2024-01-02T00:00:00Z',
      }),
    ];
    const remote = [
      makeHighlight({
        id: 'shared',
        comment: 'remote edit',
        modifiedAt: '2024-01-03T00:00:00Z',
      }),
    ];

    const merged = mergeAnnotations(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].comment).toBe('remote edit');
  });

  test('keeps local when local modifiedAt is later', () => {
    const local = [
      makeHighlight({
        id: 'shared',
        comment: 'local edit',
        modifiedAt: '2024-01-05T00:00:00Z',
      }),
    ];
    const remote = [
      makeHighlight({
        id: 'shared',
        comment: 'remote edit',
        modifiedAt: '2024-01-03T00:00:00Z',
      }),
    ];

    const merged = mergeAnnotations(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].comment).toBe('local edit');
  });

  test('handles empty local', () => {
    const remote = [makeNote()];
    const merged = mergeAnnotations([], remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('ann-2');
  });

  test('handles empty remote', () => {
    const local = [makeHighlight()];
    const merged = mergeAnnotations(local, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('ann-1');
  });

  test('handles both empty', () => {
    expect(mergeAnnotations([], [])).toEqual([]);
  });

  test('sorts by page then y position descending', () => {
    const anns = [
      makeHighlight({ id: 'a', page: 2, rects: [{ x1: 0, y1: 100, x2: 100, y2: 112 }] }),
      makeHighlight({ id: 'b', page: 1, rects: [{ x1: 0, y1: 500, x2: 100, y2: 512 }] }),
      makeHighlight({ id: 'c', page: 1, rects: [{ x1: 0, y1: 700, x2: 100, y2: 712 }] }),
    ];

    const merged = mergeAnnotations(anns, []);
    expect(merged[0].id).toBe('c'); // page 1, y=700 (highest)
    expect(merged[1].id).toBe('b'); // page 1, y=500
    expect(merged[2].id).toBe('a'); // page 2
  });

  test('real-world conflict scenario: Alice and Bob annotate offline', () => {
    // Alice adds highlight H1 offline
    const aliceAnnotations = [
      makeHighlight({ id: 'h1', comment: 'Alice highlight', createdBy: 'alice' }),
    ];

    // Bob adds note N1 offline
    const bobAnnotations = [
      makeNote({ id: 'n1', content: 'Bob note', createdBy: 'bob' }),
    ];

    // Alice syncs first, then Bob's client merges
    const merged = mergeAnnotations(bobAnnotations, aliceAnnotations);
    expect(merged).toHaveLength(2);
    expect(merged.some((a) => a.id === 'h1')).toBe(true);
    expect(merged.some((a) => a.id === 'n1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sidecar Tests
// ---------------------------------------------------------------------------

describe('buildSidecar', () => {
  test('builds valid sidecar JSON structure', () => {
    const annotations = [makeHighlight()];
    const sidecar = buildSidecar('att-1', annotations, 3, 'user@example.com');

    expect(sidecar.schemaVersion).toBe(1);
    expect(sidecar.attachmentId).toBe('att-1');
    expect(sidecar.version).toBe(3);
    expect(sidecar.createdBy).toBe('user@example.com');
    expect(sidecar.annotations).toEqual(annotations);
    expect(sidecar.lastModified).toBeTruthy();
  });
});

describe('parseSidecar', () => {
  test('parses valid sidecar JSON', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      attachmentId: 'att-1',
      lastModified: '2024-01-01T00:00:00Z',
      version: 2,
      createdBy: 'user@example.com',
      annotations: [makeHighlight()],
    });

    const parsed = parseSidecar(json);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.annotations).toHaveLength(1);
  });

  test('rejects unsupported schema version', () => {
    const json = JSON.stringify({
      schemaVersion: 99,
      attachmentId: 'att-1',
      annotations: [],
    });

    expect(() => parseSidecar(json)).toThrow('Unsupported annotation schema version');
  });

  test('rejects invalid annotations field', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      attachmentId: 'att-1',
      annotations: 'not-an-array',
    });

    expect(() => parseSidecar(json)).toThrow('annotations must be an array');
  });
});

// ---------------------------------------------------------------------------
// Row Conversion Tests
// ---------------------------------------------------------------------------

describe('rowToAnnotationSet', () => {
  test('converts raw row to domain object', () => {
    const row: AnnotationSetRow = {
      id: 'as-1',
      attachmentId: 'att-1',
      annotations: JSON.stringify([makeHighlight()]),
      driveFileId: 'drive-123',
      driveRevision: 'rev-1',
      localVersion: 3,
      remoteVersion: 2,
      isDirty: 1,
      createdBy: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      modifiedAt: '2024-01-01T00:00:00Z',
    };

    const result = rowToAnnotationSet(row);
    expect(result.isDirty).toBe(true);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].type).toBe('highlight');
  });

  test('converts isDirty = 0 to false', () => {
    const row: AnnotationSetRow = {
      id: 'as-1',
      attachmentId: 'att-1',
      annotations: '[]',
      driveFileId: null,
      driveRevision: null,
      localVersion: 1,
      remoteVersion: 0,
      isDirty: 0,
      createdBy: null,
      createdAt: '2024-01-01T00:00:00Z',
      modifiedAt: '2024-01-01T00:00:00Z',
    };

    const result = rowToAnnotationSet(row);
    expect(result.isDirty).toBe(false);
  });
});
