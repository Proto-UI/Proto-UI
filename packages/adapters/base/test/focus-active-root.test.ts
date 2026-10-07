import { expect, it } from 'vitest';
import { isWebFocusTargetActive } from '../src/platform/focus-entry';

it.each(['document', 'open', 'closed', 'nested'] as const)(
  'reads only the owned %s root and rejects siblings, blur and detached targets',
  (mode) => {
    const host = document.createElement('div');
    document.body.append(host);
    let container: HTMLElement | ShadowRoot = host;
    if (mode !== 'document')
      container = host.attachShadow({ mode: mode === 'closed' ? 'closed' : 'open' });
    if (mode === 'nested') {
      const inner = document.createElement('div');
      container.append(inner);
      container = inner.attachShadow({ mode: 'closed' });
    }
    const target = document.createElement('button'),
      sibling = document.createElement('button');
    container.append(target, sibling);
    try {
      expect(isWebFocusTargetActive(target)).toBe(false);
      target.focus();
      expect(isWebFocusTargetActive(target)).toBe(true);
      expect(isWebFocusTargetActive(sibling)).toBe(false);
      sibling.focus();
      expect(isWebFocusTargetActive(target)).toBe(false);
      expect(isWebFocusTargetActive(sibling)).toBe(true);
      sibling.blur();
      expect(isWebFocusTargetActive(sibling)).toBe(false);
      target.focus();
      host.remove();
      expect(isWebFocusTargetActive(target)).toBe(false);
    } finally {
      host.remove();
    }
  }
);
