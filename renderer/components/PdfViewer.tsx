/**
 * CloudBib — PDF Viewer Component
 *
 * Integrates PDF.js to render PDFs and overlays annotation data
 * using the existing annotation service. Supports highlights, notes,
 * and area annotations.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { Annotation } from '../types';

interface PdfViewerProps {
  pdfPath: string | null;
  annotations: Annotation[];
  onAnnotationsChange?: (annotations: Annotation[]) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'auto',
    background: '#525659',
  },
  pageContainer: {
    position: 'relative',
    margin: '16px auto',
    background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  canvas: {
    display: 'block',
  },
  annotationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  highlight: {
    position: 'absolute',
    pointerEvents: 'auto',
    cursor: 'pointer',
    opacity: 0.3,
  },
  noteMarker: {
    position: 'absolute',
    width: '20px',
    height: '20px',
    background: '#ffd700',
    borderRadius: '50%',
    border: '2px solid #e6b800',
    cursor: 'pointer',
    pointerEvents: 'auto',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    padding: '8px 16px',
    background: '#f0f0f0',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    fontSize: '14px',
  },
  pageInfo: {
    fontSize: '12px',
    color: '#666',
  },
};

export function PdfViewer({ pdfPath, annotations }: PdfViewerProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale] = useState(1.5);
  const [pageAnnotations, setPageAnnotations] = useState<Annotation[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Filter annotations for current page
  useEffect(() => {
    setPageAnnotations(annotations.filter((a) => a.page === currentPage));
  }, [annotations, currentPage]);

  // PDF.js rendering is only functional in an Electron environment.
  // In a browser context without pdfjs-dist loaded at runtime, we show a placeholder.
  useEffect(() => {
    if (!pdfPath || !canvasRef.current) return;

    // Dynamic import of pdfjs-dist for Electron context
    void (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        const pdf = await loadingTask.promise;
        setTotalPages(pdf.numPages);

        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setCanvasSize({ width: viewport.width, height: viewport.height });

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        console.error('PDF rendering error:', err);
      }
    })();
  }, [pdfPath, currentPage, scale]);

  if (!pdfPath) {
    return (
      <div style={styles.placeholder}>
        Select a PDF attachment to view
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={styles.toolbar}>
        <button
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        >
          ← Prev
        </button>
        <span style={styles.pageInfo}>
          Page {currentPage} of {totalPages || '?'}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        >
          Next →
        </button>
      </div>
      <div style={styles.container}>
        <div
          style={{
            ...styles.pageContainer,
            width: canvasSize.width || 'auto',
            height: canvasSize.height || 'auto',
          }}
        >
          <canvas ref={canvasRef} style={styles.canvas} />
          <div style={styles.annotationOverlay}>
            {pageAnnotations.map((ann) => {
              if (ann.type === 'highlight' && ann.rects) {
                return ann.rects.map((rect, ri) => (
                  <div
                    key={`${ann.id}-${ri}`}
                    style={{
                      ...styles.highlight,
                      left: `${rect.x1}px`,
                      top: `${rect.y1}px`,
                      width: `${rect.x2 - rect.x1}px`,
                      height: `${rect.y2 - rect.y1}px`,
                      background: ann.color ?? '#ffff00',
                    }}
                    title={ann.comment ?? ann.text ?? ''}
                  />
                ));
              }
              if (ann.type === 'note' && ann.position) {
                return (
                  <div
                    key={ann.id}
                    style={{
                      ...styles.noteMarker,
                      left: `${ann.position.x}px`,
                      top: `${ann.position.y}px`,
                    }}
                    title={ann.comment ?? ann.content ?? ''}
                  >
                    📝
                  </div>
                );
              }
              if (ann.type === 'area' && ann.rects && ann.rects.length > 0) {
                const rect = ann.rects[0];
                return (
                  <div
                    key={ann.id}
                    style={{
                      ...styles.highlight,
                      left: `${rect.x1}px`,
                      top: `${rect.y1}px`,
                      width: `${rect.x2 - rect.x1}px`,
                      height: `${rect.y2 - rect.y1}px`,
                      background: ann.color ?? 'rgba(0, 100, 255, 0.2)',
                      border: '2px dashed rgba(0, 100, 255, 0.5)',
                    }}
                    title={ann.comment ?? ''}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
