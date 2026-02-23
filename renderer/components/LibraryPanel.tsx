/**
 * CloudBib — Library Panel Component
 *
 * Left sidebar showing the library tree / collections.
 * Allows creating and selecting libraries.
 */

import React, { useEffect, useState } from 'react';
import type { Library } from '../types';

interface LibraryPanelProps {
  selectedLibrary: Library | null;
  onSelectLibrary: (library: Library) => void;
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
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  item: {
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    borderBottom: '1px solid #eee',
  },
  itemSelected: {
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    borderBottom: '1px solid #eee',
    background: '#e3f2fd',
    fontWeight: 500,
  },
  badge: {
    fontSize: '11px',
    color: '#888',
    marginLeft: '6px',
  },
  empty: {
    padding: '16px',
    color: '#888',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
};

export function LibraryPanel({ selectedLibrary, onSelectLibrary }: LibraryPanelProps): React.JSX.Element {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLibraries();
  }, []);

  async function loadLibraries(): Promise<void> {
    try {
      const libs = await window.cloudbib.listLibraries();
      setLibraries(libs);
    } catch (err) {
      console.error('Failed to load libraries:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateLibrary(): Promise<void> {
    const name = prompt('Library name:');
    if (!name) return;

    try {
      const lib = await window.cloudbib.createLibrary(name, 'personal');
      setLibraries((prev) => [...prev, lib]);
      onSelectLibrary(lib);
    } catch (err) {
      console.error('Failed to create library:', err);
    }
  }

  if (loading) {
    return (
      <div>
        <div style={styles.header}>Libraries</div>
        <div style={styles.empty}>Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.header}>
        <span>Libraries</span>
        <button style={styles.addButton} onClick={handleCreateLibrary}>
          + New
        </button>
      </div>
      {libraries.length === 0 ? (
        <div style={styles.empty}>
          No libraries yet.<br />
          Click "+ New" to create one.
        </div>
      ) : (
        <ul style={styles.list}>
          {libraries.map((lib) => (
            <li
              key={lib.id}
              style={selectedLibrary?.id === lib.id ? styles.itemSelected : styles.item}
              onClick={() => onSelectLibrary(lib)}
            >
              {lib.name}
              <span style={styles.badge}>{lib.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
