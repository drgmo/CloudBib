/**
 * CloudBib — React App Root Component
 *
 * Three-panel layout:
 *  - Left: Library tree / collections
 *  - Center: Items list (papers)
 *  - Right: Item details (metadata, notes, citations)
 */

import React, { useState } from 'react';
import { LibraryPanel } from './components/LibraryPanel';
import { ItemsPanel } from './components/ItemsPanel';
import { DetailsPanel } from './components/DetailsPanel';
import type { Library, Item } from './types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
  },
  left: {
    width: '220px',
    minWidth: '180px',
    borderRight: '1px solid #ddd',
    background: '#fafafa',
    overflow: 'auto',
  },
  center: {
    flex: 1,
    minWidth: '300px',
    borderRight: '1px solid #ddd',
    overflow: 'auto',
  },
  right: {
    width: '320px',
    minWidth: '250px',
    overflow: 'auto',
    background: '#fafafa',
  },
};

export function App(): React.JSX.Element {
  const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <LibraryPanel
          selectedLibrary={selectedLibrary}
          onSelectLibrary={(lib) => {
            setSelectedLibrary(lib);
            setSelectedItem(null);
          }}
        />
      </div>
      <div style={styles.center}>
        <ItemsPanel
          library={selectedLibrary}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
        />
      </div>
      <div style={styles.right}>
        <DetailsPanel item={selectedItem} />
      </div>
    </div>
  );
}
