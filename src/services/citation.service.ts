/**
 * CloudBib — Citation Service
 *
 * Exports library items to BibTeX and CSL-JSON formats.
 * Handles item-type mapping, cite-key generation, and special character escaping.
 */

import type { Item, CslJsonEntry, ItemType } from '../models/types';

// ---------------------------------------------------------------------------
// Item-type mappings
// ---------------------------------------------------------------------------

const ITEM_TYPE_TO_BIBTEX: Record<ItemType, string> = {
  journalArticle: 'article',
  book: 'book',
  bookSection: 'incollection',
  conferencePaper: 'inproceedings',
  thesis: 'phdthesis',
  report: 'techreport',
  webpage: 'misc',
  preprint: 'unpublished',
  patent: 'misc',
  other: 'misc',
};

const ITEM_TYPE_TO_CSL: Record<ItemType, string> = {
  journalArticle: 'article-journal',
  book: 'book',
  bookSection: 'chapter',
  conferencePaper: 'paper-conference',
  thesis: 'thesis',
  report: 'report',
  webpage: 'webpage',
  preprint: 'article',
  patent: 'patent',
  other: 'document',
};

// ---------------------------------------------------------------------------
// BibTeX Export
// ---------------------------------------------------------------------------

/**
 * Escapes special LaTeX characters in a string.
 */
export function escapeBibtex(value: string): string {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}~^]/g, (match) => `\\${match}`);
}

/**
 * Generates a BibTeX cite key from an item: AuthorYear with disambiguation suffix.
 */
export function generateCiteKey(item: Item, existingKeys: Set<string>): string {
  const firstAuthor =
    item.authors.length > 0 ? item.authors[0].family : 'Unknown';
  const year = item.year ?? 'nd';
  const base = `${firstAuthor.replace(/\s+/g, '')}${year}`;

  let key = base;
  let suffix = 0;
  while (existingKeys.has(key)) {
    suffix++;
    key = `${base}${String.fromCharCode(96 + suffix)}`; // a, b, c, ...
  }
  existingKeys.add(key);
  return key;
}

/**
 * Exports a single Item to a BibTeX entry string.
 */
export function itemToBibtex(item: Item, citeKey: string): string {
  const entryType = ITEM_TYPE_TO_BIBTEX[item.itemType] ?? 'misc';
  const fields: string[] = [];

  if (item.title) {
    fields.push(`  title = {${escapeBibtex(item.title)}}`);
  }

  if (item.authors.length > 0) {
    const authorStr = item.authors
      .map((a) => `${escapeBibtex(a.family)}, ${escapeBibtex(a.given)}`)
      .join(' and ');
    fields.push(`  author = {${authorStr}}`);
  }

  if (item.year) fields.push(`  year = {${item.year}}`);
  if (item.journal) fields.push(`  journal = {${escapeBibtex(item.journal)}}`);
  if (item.volume) fields.push(`  volume = {${item.volume}}`);
  if (item.issue) fields.push(`  number = {${item.issue}}`);
  if (item.pages) fields.push(`  pages = {${escapeBibtex(item.pages)}}`);
  if (item.doi) fields.push(`  doi = {${item.doi}}`);
  if (item.isbn) fields.push(`  isbn = {${item.isbn}}`);

  return `@${entryType}{${citeKey},\n${fields.join(',\n')}\n}`;
}

/**
 * Exports multiple items to a complete BibTeX string.
 */
export function exportBibtex(items: Item[]): string {
  const keys = new Set<string>();
  return items
    .filter((item) => !item.deleted)
    .map((item) => {
      const key = generateCiteKey(item, keys);
      return itemToBibtex(item, key);
    })
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// CSL-JSON Export
// ---------------------------------------------------------------------------

/**
 * Converts an Item to a CSL-JSON entry.
 */
export function itemToCslJson(item: Item): CslJsonEntry {
  const entry: CslJsonEntry = {
    id: item.id,
    type: ITEM_TYPE_TO_CSL[item.itemType] ?? 'document',
  };

  if (item.title) entry.title = item.title;

  if (item.authors.length > 0) {
    entry.author = item.authors.map((a) => ({
      given: a.given,
      family: a.family,
    }));
  }

  if (item.year) {
    entry.issued = { 'date-parts': [[parseInt(item.year, 10) || item.year]] };
  }

  if (item.journal) entry['container-title'] = item.journal;
  if (item.volume) entry.volume = item.volume;
  if (item.issue) entry.issue = item.issue;
  if (item.pages) entry.page = item.pages;
  if (item.doi) entry.DOI = item.doi;
  if (item.isbn) entry.ISBN = item.isbn;
  if (item.abstract) entry.abstract = item.abstract;

  return entry;
}

/**
 * Exports multiple items to a CSL-JSON array string.
 */
export function exportCslJson(items: Item[]): string {
  const entries = items
    .filter((item) => !item.deleted)
    .map(itemToCslJson);
  return JSON.stringify(entries, null, 2);
}

// ---------------------------------------------------------------------------
// RIS Export (basic)
// ---------------------------------------------------------------------------

const ITEM_TYPE_TO_RIS: Record<ItemType, string> = {
  journalArticle: 'JOUR',
  book: 'BOOK',
  bookSection: 'CHAP',
  conferencePaper: 'CONF',
  thesis: 'THES',
  report: 'RPRT',
  webpage: 'ELEC',
  preprint: 'UNPB',
  patent: 'PAT',
  other: 'GEN',
};

/**
 * Exports a single Item to RIS format.
 */
export function itemToRis(item: Item): string {
  const lines: string[] = [];
  const risType = ITEM_TYPE_TO_RIS[item.itemType] ?? 'GEN';

  lines.push(`TY  - ${risType}`);
  if (item.title) lines.push(`TI  - ${item.title}`);

  for (const author of item.authors) {
    lines.push(`AU  - ${author.family}, ${author.given}`);
  }

  if (item.year) lines.push(`PY  - ${item.year}`);
  if (item.journal) lines.push(`JO  - ${item.journal}`);
  if (item.volume) lines.push(`VL  - ${item.volume}`);
  if (item.issue) lines.push(`IS  - ${item.issue}`);
  if (item.pages) {
    const parts = item.pages.split('-');
    if (parts[0]) lines.push(`SP  - ${parts[0].trim()}`);
    if (parts[1]) lines.push(`EP  - ${parts[1].trim()}`);
  }
  if (item.doi) lines.push(`DO  - ${item.doi}`);
  if (item.isbn) lines.push(`SN  - ${item.isbn}`);
  if (item.abstract) lines.push(`AB  - ${item.abstract}`);

  lines.push('ER  - ');
  return lines.join('\n');
}

/**
 * Exports multiple items to RIS format.
 */
export function exportRis(items: Item[]): string {
  return items
    .filter((item) => !item.deleted)
    .map(itemToRis)
    .join('\n\n');
}
