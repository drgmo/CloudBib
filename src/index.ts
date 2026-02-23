/**
 * CloudBib — Public API
 *
 * Re-exports all services, models, and database utilities.
 */

// Models
export * from './models/types';

// Database
export { openDatabase, applyMigrations } from './db/connection';
export { MIGRATIONS, getBootstrapSQL } from './db/schema';

// Services
export {
  LibraryService,
  DuplicateError,
  NotFoundError,
  IntegrityError,
  rowToItem,
} from './services/library.service';

export {
  mergeAnnotations,
  buildSidecar,
  parseSidecar,
  rowToAnnotationSet,
} from './services/annotation.service';

export {
  exportBibtex,
  exportCslJson,
  exportRis,
  itemToBibtex,
  itemToCslJson,
  itemToRis,
  generateCiteKey,
  escapeBibtex,
} from './services/citation.service';

export {
  CacheService,
  computeSHA256,
} from './services/cache.service';

export type { ICacheService } from './services/cache.service';

export {
  sanitizeFilename,
  buildDriveFileName,
  withRetry,
} from './services/drive.service';

export type { IDriveService } from './services/drive.service';

export { SyncService } from './services/sync.service';
export type { IBackendApi } from './services/sync.service';
