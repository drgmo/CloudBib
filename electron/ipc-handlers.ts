/**
 * CloudBib — IPC Handlers
 *
 * Registers Electron IPC handlers that bridge the renderer process
 * to the existing CloudBib core services. All database and business
 * logic stays in the main process; the renderer communicates via IPC.
 */

import type { IpcMain } from 'electron';
import type Database from 'better-sqlite3';
import type { LibraryService } from '../src/services/library.service';
import type { ItemType, Author, Annotation, AnnotationSetRow } from '../src/models/types';
import { exportBibtex, exportCslJson, exportRis } from '../src/services/citation.service';
import { rowToItem } from '../src/services/library.service';
import { rowToAnnotationSet } from '../src/services/annotation.service';
import type { ItemRow } from '../src/models/types';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  libraryService: LibraryService,
  db: Database.Database
): void {
  // -------------------------------------------------------------------------
  // Library handlers
  // -------------------------------------------------------------------------

  ipcMain.handle('library:list', () => {
    return libraryService.listLibraries();
  });

  ipcMain.handle('library:create', (_event, name: string, type: 'personal' | 'group') => {
    return libraryService.createLibrary(name, type);
  });

  // -------------------------------------------------------------------------
  // Item handlers
  // -------------------------------------------------------------------------

  ipcMain.handle('items:list', (_event, libraryId: string) => {
    return libraryService.listItems(libraryId);
  });

  ipcMain.handle('items:get', (_event, id: string) => {
    return libraryService.getItem(id);
  });

  ipcMain.handle(
    'items:create',
    (
      _event,
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
    ) => {
      return libraryService.createItem(libraryId, data);
    }
  );

  ipcMain.handle(
    'items:update',
    (_event, id: string, data: Record<string, unknown>) => {
      return libraryService.updateItem(id, data);
    }
  );

  ipcMain.handle('items:delete', (_event, id: string) => {
    libraryService.deleteItem(id);
  });

  // -------------------------------------------------------------------------
  // Attachment handlers
  // -------------------------------------------------------------------------

  ipcMain.handle('attachments:listForItem', (_event, itemId: string) => {
    return libraryService.getAttachmentsForItem(itemId);
  });

  // -------------------------------------------------------------------------
  // Citation export handlers
  // -------------------------------------------------------------------------

  ipcMain.handle(
    'citations:export',
    (_event, itemIds: string[], format: string) => {
      const items = itemIds
        .map((id) => {
          const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
            | ItemRow
            | undefined;
          return row ? rowToItem(row) : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      switch (format) {
        case 'bibtex':
          return exportBibtex(items);
        case 'csljson':
          return exportCslJson(items);
        case 'ris':
          return exportRis(items);
        default:
          throw new Error(`Unknown citation format: ${format}`);
      }
    }
  );

  // -------------------------------------------------------------------------
  // Annotation handlers
  // -------------------------------------------------------------------------

  ipcMain.handle('annotations:get', (_event, attachmentId: string) => {
    const row = db
      .prepare('SELECT * FROM annotation_sets WHERE attachmentId = ?')
      .get(attachmentId) as AnnotationSetRow | undefined;

    if (!row) return [];
    const set = rowToAnnotationSet(row);
    return set.annotations;
  });

  ipcMain.handle(
    'annotations:save',
    async (_event, attachmentId: string, annotations: Annotation[]) => {
      await libraryService.saveAnnotations(attachmentId, annotations);
    }
  );
}
