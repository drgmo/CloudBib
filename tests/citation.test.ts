/**
 * CloudBib — Citation Service Tests
 *
 * Tests BibTeX, CSL-JSON, and RIS export functionality.
 */

import {
  exportBibtex,
  exportCslJson,
  exportRis,
  itemToBibtex,
  itemToCslJson,
  itemToRis,
  generateCiteKey,
  escapeBibtex,
} from '../src/services/citation.service';
import type { Item } from '../src/models/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-id-1',
    libraryId: 'lib-1',
    itemType: 'journalArticle',
    title: 'Deep Learning for NLP',
    authors: [
      { given: 'Alice', family: 'Smith' },
      { given: 'Bob', family: 'Jones' },
    ],
    year: '2024',
    journal: 'Nature Machine Intelligence',
    volume: '6',
    issue: '3',
    pages: '100-115',
    doi: '10.1234/nmi.2024.001',
    isbn: null,
    abstract: 'A survey of deep learning methods for NLP.',
    tags: ['deep-learning', 'nlp'],
    extra: {},
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    version: 1,
    deleted: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BibTeX Tests
// ---------------------------------------------------------------------------

describe('BibTeX Export', () => {
  test('escapeBibtex escapes special LaTeX characters', () => {
    expect(escapeBibtex('A & B')).toBe('A \\& B');
    expect(escapeBibtex('100%')).toBe('100\\%');
    expect(escapeBibtex('$10')).toBe('\\$10');
    expect(escapeBibtex('item #5')).toBe('item \\#5');
    expect(escapeBibtex('under_score')).toBe('under\\_score');
  });

  test('generateCiteKey creates AuthorYear format', () => {
    const keys = new Set<string>();
    const item = makeItem();
    const key = generateCiteKey(item, keys);
    expect(key).toBe('Smith2024');
    expect(keys.has('Smith2024')).toBe(true);
  });

  test('generateCiteKey disambiguates duplicate keys', () => {
    const keys = new Set<string>();
    const item1 = makeItem();
    const item2 = makeItem({ id: 'test-id-2', title: 'Another Paper' });

    const key1 = generateCiteKey(item1, keys);
    const key2 = generateCiteKey(item2, keys);

    expect(key1).toBe('Smith2024');
    expect(key2).toBe('Smith2024a');
  });

  test('generateCiteKey handles missing author', () => {
    const keys = new Set<string>();
    const item = makeItem({ authors: [] });
    const key = generateCiteKey(item, keys);
    expect(key).toBe('Unknown2024');
  });

  test('generateCiteKey handles missing year', () => {
    const keys = new Set<string>();
    const item = makeItem({ year: null });
    const key = generateCiteKey(item, keys);
    expect(key).toBe('Smithnd');
  });

  test('itemToBibtex produces valid BibTeX entry', () => {
    const item = makeItem();
    const bib = itemToBibtex(item, 'Smith2024');

    expect(bib).toContain('@article{Smith2024,');
    expect(bib).toContain('title = {Deep Learning for NLP}');
    expect(bib).toContain('author = {Smith, Alice and Jones, Bob}');
    expect(bib).toContain('year = {2024}');
    expect(bib).toContain('journal = {Nature Machine Intelligence}');
    expect(bib).toContain('volume = {6}');
    expect(bib).toContain('number = {3}');
    expect(bib).toContain('pages = {100-115}');
    expect(bib).toContain('doi = {10.1234/nmi.2024.001}');
  });

  test('itemToBibtex maps item types correctly', () => {
    const book = makeItem({ itemType: 'book' });
    expect(itemToBibtex(book, 'key')).toContain('@book{key,');

    const conf = makeItem({ itemType: 'conferencePaper' });
    expect(itemToBibtex(conf, 'key')).toContain('@inproceedings{key,');

    const thesis = makeItem({ itemType: 'thesis' });
    expect(itemToBibtex(thesis, 'key')).toContain('@phdthesis{key,');
  });

  test('exportBibtex exports multiple items', () => {
    const items = [
      makeItem({ id: '1', title: 'Paper A' }),
      makeItem({ id: '2', title: 'Paper B', authors: [{ given: 'Carol', family: 'Lee' }] }),
    ];

    const result = exportBibtex(items);
    expect(result).toContain('@article{Smith2024,');
    expect(result).toContain('@article{Lee2024,');
    expect(result).toContain('Paper A');
    expect(result).toContain('Paper B');
  });

  test('exportBibtex skips deleted items', () => {
    const items = [
      makeItem({ id: '1', title: 'Active Paper' }),
      makeItem({ id: '2', title: 'Deleted Paper', deleted: true }),
    ];

    const result = exportBibtex(items);
    expect(result).toContain('Active Paper');
    expect(result).not.toContain('Deleted Paper');
  });
});

// ---------------------------------------------------------------------------
// CSL-JSON Tests
// ---------------------------------------------------------------------------

describe('CSL-JSON Export', () => {
  test('itemToCslJson produces valid CSL-JSON entry', () => {
    const item = makeItem();
    const csl = itemToCslJson(item);

    expect(csl.id).toBe('test-id-1');
    expect(csl.type).toBe('article-journal');
    expect(csl.title).toBe('Deep Learning for NLP');
    expect(csl.author).toEqual([
      { given: 'Alice', family: 'Smith' },
      { given: 'Bob', family: 'Jones' },
    ]);
    expect(csl.issued).toEqual({ 'date-parts': [[2024]] });
    expect(csl['container-title']).toBe('Nature Machine Intelligence');
    expect(csl.volume).toBe('6');
    expect(csl.issue).toBe('3');
    expect(csl.page).toBe('100-115');
    expect(csl.DOI).toBe('10.1234/nmi.2024.001');
  });

  test('itemToCslJson maps item types correctly', () => {
    expect(itemToCslJson(makeItem({ itemType: 'book' })).type).toBe('book');
    expect(itemToCslJson(makeItem({ itemType: 'conferencePaper' })).type).toBe('paper-conference');
    expect(itemToCslJson(makeItem({ itemType: 'thesis' })).type).toBe('thesis');
  });

  test('exportCslJson produces valid JSON array', () => {
    const items = [
      makeItem({ id: '1' }),
      makeItem({ id: '2' }),
    ];

    const result = exportCslJson(items);
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('1');
    expect(parsed[1].id).toBe('2');
  });

  test('exportCslJson skips deleted items', () => {
    const items = [
      makeItem({ id: '1' }),
      makeItem({ id: '2', deleted: true }),
    ];

    const result = exportCslJson(items);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// RIS Tests
// ---------------------------------------------------------------------------

describe('RIS Export', () => {
  test('itemToRis produces valid RIS entry', () => {
    const item = makeItem();
    const ris = itemToRis(item);

    expect(ris).toContain('TY  - JOUR');
    expect(ris).toContain('TI  - Deep Learning for NLP');
    expect(ris).toContain('AU  - Smith, Alice');
    expect(ris).toContain('AU  - Jones, Bob');
    expect(ris).toContain('PY  - 2024');
    expect(ris).toContain('JO  - Nature Machine Intelligence');
    expect(ris).toContain('VL  - 6');
    expect(ris).toContain('IS  - 3');
    expect(ris).toContain('SP  - 100');
    expect(ris).toContain('EP  - 115');
    expect(ris).toContain('DO  - 10.1234/nmi.2024.001');
    expect(ris).toContain('ER  - ');
  });

  test('itemToRis maps item types correctly', () => {
    expect(itemToRis(makeItem({ itemType: 'book' }))).toContain('TY  - BOOK');
    expect(itemToRis(makeItem({ itemType: 'conferencePaper' }))).toContain('TY  - CONF');
    expect(itemToRis(makeItem({ itemType: 'thesis' }))).toContain('TY  - THES');
  });

  test('exportRis exports multiple items', () => {
    const items = [
      makeItem({ id: '1' }),
      makeItem({ id: '2' }),
    ];

    const result = exportRis(items);
    const entries = result.split('ER  - ');
    // Last split element is empty string
    expect(entries.length - 1).toBe(2);
  });

  test('exportRis skips deleted items', () => {
    const items = [
      makeItem({ id: '1' }),
      makeItem({ id: '2', deleted: true }),
    ];

    const result = exportRis(items);
    expect(result.match(/TY  -/g)?.length).toBe(1);
  });
});
