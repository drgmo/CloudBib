/**
 * CloudBib — Library Service Tests
 *
 * Tests the LibraryService CRUD operations using a real in-memory SQLite database.
 */

import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { LibraryService, DuplicateError, NotFoundError, rowToItem } from '../src/services/library.service';
import { applyMigrations } from '../src/db/connection';
import type { IDriveService } from '../src/services/drive.service';
import type { ICacheService } from '../src/services/cache.service';
import type { ItemRow } from '../src/models/types';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let db: Database.Database;
let service: LibraryService;
let mockDrive: jest.Mocked<IDriveService>;
let mockCache: jest.Mocked<ICacheService>;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applyMigrations(db);

  mockDrive = {
    ensureFolder: jest.fn().mockResolvedValue('folder-id'),
    uploadResumable: jest.fn().mockResolvedValue({
      id: 'drive-file-id',
      name: 'test.pdf',
      mimeType: 'application/pdf',
      size: 1000,
      headRevisionId: 'rev-1',
      webViewLink: 'https://drive.google.com/file/d/drive-file-id/view',
      parents: ['folder-id'],
    }),
    downloadFile: jest.fn().mockResolvedValue(undefined),
    downloadJSON: jest.fn(),
    getFileMetadata: jest.fn(),
    createFile: jest.fn(),
    updateFile: jest.fn(),
    isOnline: jest.fn().mockResolvedValue(true),
  };

  mockCache = {
    getPdfPath: jest.fn().mockReturnValue(null),
    isValid: jest.fn().mockResolvedValue(false),
    allocatePath: jest.fn().mockReturnValue('/tmp/cache/test.pdf'),
    storePdf: jest.fn().mockResolvedValue('/tmp/cache/test.pdf'),
    getAnnotationPath: jest.fn().mockReturnValue('/tmp/cache/ann.json'),
    getCacheStats: jest.fn().mockReturnValue({ pdfCount: 0, totalSizeBytes: 0 }),
  };

  service = new LibraryService(db, mockDrive, mockCache, () => 'test-user');
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// Library CRUD
// ---------------------------------------------------------------------------

describe('Library CRUD', () => {
  test('createLibrary creates a personal library', () => {
    const lib = service.createLibrary('My Library', 'personal');
    expect(lib.name).toBe('My Library');
    expect(lib.type).toBe('personal');
    expect(lib.groupId).toBeNull();
    expect(lib.id).toBeTruthy();
  });

  test('createLibrary creates a group library', () => {
    const lib = service.createLibrary('Team Lib', 'group', 'group-1');
    expect(lib.type).toBe('group');
    expect(lib.groupId).toBe('group-1');
  });

  test('getLibrary returns null for non-existent', () => {
    expect(service.getLibrary('nonexistent')).toBeNull();
  });

  test('listLibraries returns all libraries', () => {
    service.createLibrary('Lib A', 'personal');
    service.createLibrary('Lib B', 'personal');
    const all = service.listLibraries();
    expect(all).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Item CRUD
// ---------------------------------------------------------------------------

describe('Item CRUD', () => {
  let libraryId: string;

  beforeEach(() => {
    const lib = service.createLibrary('Test Lib', 'personal');
    libraryId = lib.id;
  });

  test('createItem creates an item with metadata', () => {
    const item = service.createItem(libraryId, {
      title: 'Test Paper',
      authors: [{ given: 'Jane', family: 'Doe' }],
      year: '2024',
      itemType: 'journalArticle',
    });

    expect(item.title).toBe('Test Paper');
    expect(item.authors).toEqual([{ given: 'Jane', family: 'Doe' }]);
    expect(item.year).toBe('2024');
    expect(item.version).toBe(1);
    expect(item.deleted).toBe(false);
  });

  test('getItem returns null for non-existent', () => {
    expect(service.getItem('nonexistent')).toBeNull();
  });

  test('listItems returns items for a library', () => {
    service.createItem(libraryId, { title: 'Paper A' });
    service.createItem(libraryId, { title: 'Paper B' });
    const items = service.listItems(libraryId);
    expect(items).toHaveLength(2);
  });

  test('listItems excludes deleted items', () => {
    const item = service.createItem(libraryId, { title: 'To Delete' });
    service.deleteItem(item.id);
    const items = service.listItems(libraryId);
    expect(items).toHaveLength(0);
  });

  test('updateItem updates fields and increments version', () => {
    const item = service.createItem(libraryId, { title: 'Original' });
    const updated = service.updateItem(item.id, { title: 'Updated' });
    expect(updated.title).toBe('Updated');
    expect(updated.version).toBe(2);
  });

  test('updateItem throws NotFoundError for non-existent', () => {
    expect(() => service.updateItem('nonexistent', { title: 'X' })).toThrow(
      NotFoundError
    );
  });

  test('deleteItem soft-deletes', () => {
    const item = service.createItem(libraryId, { title: 'To Delete' });
    service.deleteItem(item.id);
    const deleted = service.getItem(item.id);
    expect(deleted?.deleted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rowToItem
// ---------------------------------------------------------------------------

describe('rowToItem', () => {
  test('converts raw row to Item with parsed JSON fields', () => {
    const row: ItemRow = {
      id: 'test',
      libraryId: 'lib-1',
      itemType: 'book',
      title: 'Test Book',
      authors: '[{"given":"A","family":"B"}]',
      year: '2024',
      journal: null,
      volume: null,
      issue: null,
      pages: null,
      doi: null,
      isbn: '978-0000000000',
      abstract: null,
      tags: '["tag1","tag2"]',
      extra: '{"key":"value"}',
      createdBy: 'user',
      createdAt: '2024-01-01',
      modifiedAt: '2024-01-01',
      version: 1,
      deleted: 0,
    };

    const item = rowToItem(row);
    expect(item.authors).toEqual([{ given: 'A', family: 'B' }]);
    expect(item.tags).toEqual(['tag1', 'tag2']);
    expect(item.extra).toEqual({ key: 'value' });
    expect(item.deleted).toBe(false);
    expect(item.itemType).toBe('book');
  });

  test('handles null JSON fields gracefully', () => {
    const row: ItemRow = {
      id: 'test',
      libraryId: 'lib-1',
      itemType: 'other',
      title: null,
      authors: null,
      year: null,
      journal: null,
      volume: null,
      issue: null,
      pages: null,
      doi: null,
      isbn: null,
      abstract: null,
      tags: null,
      extra: null,
      createdBy: null,
      createdAt: '2024-01-01',
      modifiedAt: '2024-01-01',
      version: 1,
      deleted: 1,
    };

    const item = rowToItem(row);
    expect(item.authors).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.extra).toEqual({});
    expect(item.deleted).toBe(true);
  });
});
