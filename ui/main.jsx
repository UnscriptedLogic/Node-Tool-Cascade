import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Library from './islands/Library.jsx';
import './ui.css';

export { proxy, subscribe, snapshot, ref } from 'valtio/vanilla';
export { connect } from './bridge.js';

const islands = new Map();
const roots = new Map();
islands.set('library', Library);

export function register(name, component) {
  islands.set(name, component);
}

export function mount(name, el) {
  const Component = islands.get(name);
  if (!Component) throw new Error(`Unknown Cascade UI island: ${name}`);
  if (!el || el.nodeType !== 1) throw new Error(`Missing container for Cascade UI island: ${name}`);
  const existing = roots.get(name);
  if (existing) {
    if (existing.el !== el) throw new Error(`Cascade UI island already mounted: ${name}`);
    return;
  }
  const root = createRoot(el);
  roots.set(name, { root, el });
  // Legacy startup code queries island elements immediately after the first mount.
  flushSync(() => root.render(createElement(Component)));
}

export function unmount(name) {
  const entry = roots.get(name);
  if (!entry) return false;
  entry.root.unmount();
  roots.delete(name);
  return true;
}
