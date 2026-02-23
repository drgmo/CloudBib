/**
 * CloudBib — Renderer Entry Point
 *
 * Mounts the React application into the DOM.
 */

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { App } from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(createElement(App));
}
