/**
 * CloudBib — Renderer Type Declarations
 *
 * Declares the `window.cloudbib` API exposed by the preload script.
 */

export interface CloudBibAPI {
  listLibraries(): Promise<Library[]>;
  createLibrary(name: string, type: 'personal' | 'group'): Promise<Library>;

  listItems(libraryId: string): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;
  createItem(libraryId: string, data: Partial<Item>): Promise<Item>;
  updateItem(id: string, data: Partial<Item>): Promise<Item>;
  deleteItem(id: string): Promise<void>;

  getAttachmentsForItem(itemId: string): Promise<Attachment[]>;

  exportCitations(itemIds: string[], format: string): Promise<string>;

  getAnnotations(attachmentId: string): Promise<Annotation[]>;
  saveAnnotations(attachmentId: string, annotations: Annotation[]): Promise<void>;
}

export interface Library {
  id: string;
  name: string;
  type: 'personal' | 'group';
  groupId: string | null;
  driveRootId: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface Author {
  given: string;
  family: string;
}

export interface Item {
  id: string;
  libraryId: string;
  itemType: string;
  title: string | null;
  authors: Author[];
  year: string | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  isbn: string | null;
  abstract: string | null;
  tags: string[];
  extra: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  modifiedAt: string;
  version: number;
  deleted: boolean;
}

export interface Attachment {
  id: string;
  itemId: string;
  filename: string;
  mime: string;
  size: number | null;
  checksum: string;
  driveFileId: string | null;
  createdAt: string;
  modifiedAt: string;
  version: number;
}

export interface Annotation {
  id: string;
  type: 'highlight' | 'note' | 'area';
  page: number;
  rects?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  position?: { x: number; y: number };
  color?: string;
  text?: string;
  content?: string;
  comment?: string;
  createdBy: string;
  createdAt: string;
  modifiedAt: string;
}

declare global {
  interface Window {
    cloudbib: CloudBibAPI;
  }
}
