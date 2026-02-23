/**
 * CloudBib — Preload Script
 *
 * Exposes a safe, typed API from the main process to the renderer
 * via contextBridge. The renderer accesses these methods through
 * `window.cloudbib`.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface CloudBibAPI {
  // Library operations
  listLibraries(): Promise<unknown[]>;
  createLibrary(name: string, type: 'personal' | 'group'): Promise<unknown>;

  // Item operations
  listItems(libraryId: string): Promise<unknown[]>;
  getItem(id: string): Promise<unknown | null>;
  createItem(libraryId: string, data: Record<string, unknown>): Promise<unknown>;
  updateItem(id: string, data: Record<string, unknown>): Promise<unknown>;
  deleteItem(id: string): Promise<void>;

  // Attachment operations
  getAttachmentsForItem(itemId: string): Promise<unknown[]>;

  // Citation export
  exportCitations(itemIds: string[], format: string): Promise<string>;

  // Annotation operations
  getAnnotations(attachmentId: string): Promise<unknown[]>;
  saveAnnotations(attachmentId: string, annotations: unknown[]): Promise<void>;
}

const api: CloudBibAPI = {
  listLibraries: () => ipcRenderer.invoke('library:list'),
  createLibrary: (name, type) => ipcRenderer.invoke('library:create', name, type),

  listItems: (libraryId) => ipcRenderer.invoke('items:list', libraryId),
  getItem: (id) => ipcRenderer.invoke('items:get', id),
  createItem: (libraryId, data) => ipcRenderer.invoke('items:create', libraryId, data),
  updateItem: (id, data) => ipcRenderer.invoke('items:update', id, data),
  deleteItem: (id) => ipcRenderer.invoke('items:delete', id),

  getAttachmentsForItem: (itemId) => ipcRenderer.invoke('attachments:listForItem', itemId),

  exportCitations: (itemIds, format) => ipcRenderer.invoke('citations:export', itemIds, format),

  getAnnotations: (attachmentId) => ipcRenderer.invoke('annotations:get', attachmentId),
  saveAnnotations: (attachmentId, annotations) =>
    ipcRenderer.invoke('annotations:save', attachmentId, annotations),
};

contextBridge.exposeInMainWorld('cloudbib', api);
