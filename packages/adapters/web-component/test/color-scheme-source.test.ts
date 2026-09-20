import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRebindableColorSchemeSource } from '../src/color-scheme-source';

afterEach(() => vi.unstubAllGlobals());

describe('default WC color-scheme source', () => {
  it('notifies every consumer and defers failures while adopting a document', () => {
    const source = createRebindableColorSchemeSource(
      () => 'light',
      document.implementation.createHTMLDocument('source')
    );
    const microtasks: (() => void)[] = [];
    vi.stubGlobal('queueMicrotask', (callback: () => void) => microtasks.push(callback));
    const failure = new Error('first default color consumer failed');
    source.subscribe(() => {
      throw failure;
    });
    const healthy = vi.fn();
    source.subscribe(healthy);

    expect(() =>
      source.adoptDocument(document.implementation.createHTMLDocument('destination'))
    ).not.toThrow();
    expect(healthy).toHaveBeenCalledOnce();
    expect(() => microtasks.shift()!()).toThrow(failure);
  });
});
