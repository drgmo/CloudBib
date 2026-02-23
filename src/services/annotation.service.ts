/**
 * CloudBib — Annotation Service
 *
 * Manages annotation CRUD, sidecar JSON serialization,
 * and annotation conflict resolution (union merge).
 */

import type {
  Annotation,
  AnnotationSet,
  AnnotationSetRow,
  AnnotationSidecar,
} from '../models/types';

// ---------------------------------------------------------------------------
// Merge Strategy
// ---------------------------------------------------------------------------

/**
 * Merges two annotation arrays using union merge.
 *
 * Rules:
 *  - Annotations with unique IDs from both sides are included.
 *  - If the same ID exists in both, keep the one with the later `modifiedAt`.
 *  - Returns the merged array sorted by page then position.
 */
export function mergeAnnotations(
  local: Annotation[],
  remote: Annotation[]
): Annotation[] {
  const merged = new Map<string, Annotation>();

  // Add all local annotations
  for (const ann of local) {
    merged.set(ann.id, ann);
  }

  // Merge remote annotations
  for (const ann of remote) {
    const existing = merged.get(ann.id);
    if (!existing) {
      // New annotation from remote
      merged.set(ann.id, ann);
    } else {
      // Same ID — keep the one with later modifiedAt
      if (ann.modifiedAt > existing.modifiedAt) {
        merged.set(ann.id, ann);
      }
    }
  }

  // Sort by page, then by position (y coordinate descending = top of page first)
  return Array.from(merged.values()).sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const ay = a.rects?.[0]?.y1 ?? a.position?.y ?? 0;
    const by = b.rects?.[0]?.y1 ?? b.position?.y ?? 0;
    return by - ay; // Higher y = higher on page in PDF coords
  });
}

// ---------------------------------------------------------------------------
// Sidecar Serialization
// ---------------------------------------------------------------------------

/**
 * Builds a sidecar JSON object from an annotation set.
 */
export function buildSidecar(
  attachmentId: string,
  annotations: Annotation[],
  version: number,
  createdBy: string
): AnnotationSidecar {
  return {
    schemaVersion: 1,
    attachmentId,
    lastModified: new Date().toISOString(),
    version,
    createdBy,
    annotations,
  };
}

/**
 * Parses a sidecar JSON string into an AnnotationSidecar object.
 * Validates schema version.
 */
export function parseSidecar(json: string): AnnotationSidecar {
  const data = JSON.parse(json) as AnnotationSidecar;
  if (data.schemaVersion !== 1) {
    throw new Error(`Unsupported annotation schema version: ${data.schemaVersion}`);
  }
  if (!Array.isArray(data.annotations)) {
    throw new Error('Invalid sidecar: annotations must be an array');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Row ↔ Domain conversions
// ---------------------------------------------------------------------------

/**
 * Converts a raw SQLite row to a domain AnnotationSet.
 */
export function rowToAnnotationSet(row: AnnotationSetRow): AnnotationSet {
  return {
    ...row,
    annotations: JSON.parse(row.annotations) as Annotation[],
    isDirty: row.isDirty === 1,
  };
}
