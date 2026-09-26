import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRebindableColorSchemeSource } from '../src/color-scheme-source';

afterEach(() => vi.unstubAllGlobals());

describe('default WC color-scheme source', () => {
  it('does not notify when adoption preserves the effective scheme', () => {
    const source = createRebindableColorSchemeSource(
      () => 'light',
      document.implementation.createHTMLDocument('source')
    );
    const listener = vi.fn();
    source.subscribe(listener);

    source.adoptDocument(document.implementation.createHTMLDocument('same-scheme'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every consumer and defers failures when adoption changes the scheme', () => {
    let scheme = 'light';
    const source = createRebindableColorSchemeSource(
      () => scheme,
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

    scheme = 'dark';
    expect(() =>
      source.adoptDocument(document.implementation.createHTMLDocument('destination'))
    ).not.toThrow();
    expect(healthy).toHaveBeenCalledOnce();
    expect(() => microtasks.shift()!()).toThrow(failure);
  });

  it('refreshes the effective baseline when consumers resubscribe', () => {
    let scheme = 'light';
    const source = createRebindableColorSchemeSource(
      () => scheme,
      document.implementation.createHTMLDocument('source')
    );
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);
    unsubscribe();

    scheme = 'dark';
    source.subscribe(listener);
    scheme = 'light';
    source.adoptDocument(document.implementation.createHTMLDocument('destination'));

    expect(listener).toHaveBeenCalledOnce();
  });
});
