/**
 * CloudBib — Items Panel Component
 *
 * Center panel showing the list of items (papers) in the selected library.
 * Allows selecting an item to view its details.
 */

import React, { useEffect, useState } from 'react';
import type { Library, Item } from '../types';

interface ItemsPanelProps {
  library: Library | null;
  selectedItem: Item | null;
  onSelectItem: (item: Item) => void;
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    padding: '12px 16px',
    fontWeight: 600,
    fontSize: '14px',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    background: '#0066cc',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    borderBottom: '2px solid #ddd',
    fontWeight: 600,
    fontSize: '12px',
    color: '#666',
    textTransform: 'uppercase' as const,
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
  },
  rowSelected: {
    background: '#e3f2fd',
  },
  empty: {
    padding: '24px 16px',
    color: '#888',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
  noLibrary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    fontSize: '14px',
  },
};

export function ItemsPanel({ library, selectedItem, onSelectItem }: ItemsPanelProps): React.JSX.Element {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (library) {
      loadItems(library.id);
    } else {
      setItems([]);
    }
  }, [library?.id]);

  async function loadItems(libraryId: string): Promise<void> {
    setLoading(true);
    try {
      const result = await window.cloudbib.listItems(libraryId);
      setItems(result);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem(): Promise<void> {
    if (!library) return;
    const title = prompt('Paper title:');
    if (!title) return;

    try {
      const item = await window.cloudbib.createItem(library.id, { title });
      setItems((prev) => [...prev, item]);
      onSelectItem(item);
    } catch (err) {
      console.error('Failed to create item:', err);
    }
  }

  if (!library) {
    return <div style={styles.noLibrary}>Select a library to view items</div>;
  }

  function formatAuthors(item: Item): string {
    if (!item.authors || item.authors.length === 0) return '';
    if (item.authors.length === 1) {
      return `${item.authors[0].family}`;
    }
    return `${item.authors[0].family} et al.`;
  }

  return (
    <div>
      <div style={styles.header}>
        <span>{library.name}</span>
        <button style={styles.addButton} onClick={handleAddItem}>
          + Add Item
        </button>
      </div>
      {loading ? (
        <div style={styles.empty}>Loading items…</div>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          No items in this library.<br />
          Click "+ Add Item" to create one.
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Author</th>
              <th style={styles.th}>Year</th>
              <th style={styles.th}>Type</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                style={selectedItem?.id === item.id ? styles.rowSelected : undefined}
                onClick={() => onSelectItem(item)}
              >
                <td style={styles.td}>{item.title ?? '(Untitled)'}</td>
                <td style={styles.td}>{formatAuthors(item)}</td>
                <td style={styles.td}>{item.year ?? ''}</td>
                <td style={styles.td}>{item.itemType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
