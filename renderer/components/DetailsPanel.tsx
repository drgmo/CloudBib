/**
 * CloudBib — Details Panel Component
 *
 * Right panel showing item metadata, notes, and citation export options.
 */

import React, { useState } from 'react';
import type { Item } from '../types';

interface DetailsPanelProps {
  item: Item | null;
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    padding: '12px 16px',
    fontWeight: 600,
    fontSize: '14px',
    borderBottom: '1px solid #ddd',
  },
  noItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    fontSize: '14px',
  },
  section: {
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase' as const,
    marginBottom: '8px',
  },
  field: {
    marginBottom: '8px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '2px',
  },
  fieldValue: {
    fontSize: '13px',
    wordBreak: 'break-word' as const,
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  tag: {
    background: '#e0e0e0',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '11px',
  },
  exportButton: {
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    marginRight: '8px',
    marginBottom: '4px',
  },
  exportOutput: {
    marginTop: '8px',
    padding: '8px',
    background: '#f8f8f8',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as const,
    maxHeight: '200px',
    overflow: 'auto',
    wordBreak: 'break-all' as const,
  },
};

export function DetailsPanel({ item }: DetailsPanelProps): React.JSX.Element {
  const [exportOutput, setExportOutput] = useState<string>('');

  if (!item) {
    return <div style={styles.noItem}>Select an item to view details</div>;
  }

  async function handleExport(format: string): Promise<void> {
    if (!item) return;
    try {
      const result = await window.cloudbib.exportCitations([item.id], format);
      setExportOutput(result);
    } catch (err) {
      console.error('Export failed:', err);
      setExportOutput('Export failed. See console for details.');
    }
  }

  function formatAuthors(): string {
    if (!item || !item.authors || item.authors.length === 0) return 'No authors';
    return item.authors.map((a) => `${a.given} ${a.family}`).join(', ');
  }

  return (
    <div>
      <div style={styles.header}>Item Details</div>

      {/* Metadata Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Metadata</div>

        <div style={styles.field}>
          <div style={styles.fieldLabel}>Title</div>
          <div style={styles.fieldValue}>{item.title ?? '(Untitled)'}</div>
        </div>

        <div style={styles.field}>
          <div style={styles.fieldLabel}>Authors</div>
          <div style={styles.fieldValue}>{formatAuthors()}</div>
        </div>

        <div style={styles.field}>
          <div style={styles.fieldLabel}>Year</div>
          <div style={styles.fieldValue}>{item.year ?? '—'}</div>
        </div>

        <div style={styles.field}>
          <div style={styles.fieldLabel}>Type</div>
          <div style={styles.fieldValue}>{item.itemType}</div>
        </div>

        {item.journal && (
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Journal</div>
            <div style={styles.fieldValue}>{item.journal}</div>
          </div>
        )}

        {item.volume && (
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Volume</div>
            <div style={styles.fieldValue}>
              {item.volume}
              {item.issue ? `(${item.issue})` : ''}
            </div>
          </div>
        )}

        {item.pages && (
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Pages</div>
            <div style={styles.fieldValue}>{item.pages}</div>
          </div>
        )}

        {item.doi && (
          <div style={styles.field}>
            <div style={styles.fieldLabel}>DOI</div>
            <div style={styles.fieldValue}>{item.doi}</div>
          </div>
        )}

        {item.isbn && (
          <div style={styles.field}>
            <div style={styles.fieldLabel}>ISBN</div>
            <div style={styles.fieldValue}>{item.isbn}</div>
          </div>
        )}
      </div>

      {/* Tags Section */}
      {item.tags && item.tags.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Tags</div>
          <div style={styles.tagList}>
            {item.tags.map((tag, i) => (
              <span key={i} style={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Abstract Section */}
      {item.abstract && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Abstract</div>
          <div style={{ ...styles.fieldValue, lineHeight: '1.4' }}>
            {item.abstract}
          </div>
        </div>
      )}

      {/* Citation Export Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Export Citation</div>
        <div>
          <button style={styles.exportButton} onClick={() => handleExport('bibtex')}>
            BibTeX
          </button>
          <button style={styles.exportButton} onClick={() => handleExport('csljson')}>
            CSL-JSON
          </button>
          <button style={styles.exportButton} onClick={() => handleExport('ris')}>
            RIS
          </button>
        </div>
        {exportOutput && <pre style={styles.exportOutput}>{exportOutput}</pre>}
      </div>
    </div>
  );
}
